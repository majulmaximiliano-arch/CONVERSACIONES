import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  foldersTable,
  tiposNegocioTable,
  marcasTable,
  dataFilesTable,
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import {
  GetMonthlyStatusQueryParams,
  GetMonthlyStatusResponse,
  GetDashboardOverviewQueryParams,
  GetDashboardOverviewResponse,
} from "@workspace/api-zod";
import { requireSession } from "../middleware/auth";

const router: IRouter = Router();

async function getAccessibleFolderIds(userId: number, role: string): Promise<number[]> {
  if (role === "admin") {
    const all = await db.select({ id: foldersTable.id }).from(foldersTable);
    return all.map((f) => f.id);
  }

  const result = await db.execute(sql`
    SELECT DISTINCT f.id
    FROM folders f
    LEFT JOIN tipos_negocio tn ON tn.id = f.tipo_negocio_id
    LEFT JOIN marcas m ON m.id = tn.marca_id
    WHERE
      EXISTS (SELECT 1 FROM folder_permissions fp WHERE fp.folder_id = f.id AND fp.user_id = ${userId})
      OR EXISTS (SELECT 1 FROM user_tipo_negocio_permissions utp WHERE utp.tipo_negocio_id = f.tipo_negocio_id AND utp.user_id = ${userId})
      OR EXISTS (SELECT 1 FROM user_marca_permissions ump WHERE ump.marca_id = m.id AND ump.user_id = ${userId})
  `);

  return (result.rows as any[]).map((r) => r.id as number);
}

router.get("/data-center/monthly-status", requireSession, async (req, res): Promise<void> => {
  const params = GetMonthlyStatusQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const user = req.sessionUser!;
  const now = new Date();
  const year = params.data.year ?? now.getFullYear();
  const month = params.data.month ?? (now.getMonth() + 1);

  const folderIds = await getAccessibleFolderIds(user.id, user.role);

  if (folderIds.length === 0) {
    res.json([]);
    return;
  }

  const idList = sql.join(folderIds.map((id) => sql`${id}`), sql`, `);
  const folders = await db
    .select({
      id: foldersTable.id,
      name: foldersTable.name,
      tipoNegocioName: tiposNegocioTable.name,
      marcaName: marcasTable.name,
    })
    .from(foldersTable)
    .leftJoin(tiposNegocioTable, eq(tiposNegocioTable.id, foldersTable.tipoNegocioId))
    .leftJoin(marcasTable, eq(marcasTable.id, tiposNegocioTable.marcaId))
    .where(sql`${foldersTable.id} = ANY(ARRAY[${idList}]::int[])`);

  const result = await Promise.all(
    folders.map(async (folder) => {
      const files = await db
        .select()
        .from(dataFilesTable)
        .where(eq(dataFilesTable.folderId, folder.id));

      const monthFiles = files.filter(
        (f) => f.periodMonth === month && f.periodYear === year && f.status === "confirmed",
      );

      const latestFile = files.sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      )[0];

      return {
        folderId: folder.id,
        folderName: folder.name,
        tipoNegocioName: folder.tipoNegocioName,
        marcaName: folder.marcaName,
        hasFileForMonth: monthFiles.length > 0,
        latestFileDate: latestFile ? latestFile.uploadedAt.toISOString() : null,
        fileCount: files.length,
      };
    }),
  );

  res.json(GetMonthlyStatusResponse.parse(result));
});

router.get("/dashboard/overview", requireSession, async (req, res): Promise<void> => {
  const user = req.sessionUser!;

  const folderIds = await getAccessibleFolderIds(user.id, user.role);
  const totalFolders = folderIds.length;

  let totalFiles = 0;
  if (folderIds.length > 0) {
    const idList = sql.join(folderIds.map((id) => sql`${id}`), sql`, `);
    const [fileCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dataFilesTable)
      .where(sql`${dataFilesTable.folderId} = ANY(ARRAY[${idList}]::int[])`);
    totalFiles = fileCountResult?.count ?? 0;
  }

  const conversationWhere = user.role === "admin" ? sql`TRUE` : eq(conversationsTable.userId, user.id);

  const [convCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversationsTable)
    .where(conversationWhere);
  const totalConversations = convCount?.count ?? 0;

  const recentConversations = await db
    .select({
      id: conversationsTable.id,
      userId: conversationsTable.userId,
      title: conversationsTable.title,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
      messageCount: sql<number>`count(${messagesTable.id})::int`,
    })
    .from(conversationsTable)
    .leftJoin(messagesTable, eq(messagesTable.conversationId, conversationsTable.id))
    .where(conversationWhere)
    .groupBy(conversationsTable.id)
    .orderBy(desc(conversationsTable.updatedAt))
    .limit(5);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let monthlyStatus: any[] = [];
  if (folderIds.length > 0) {
    const idList = sql.join(folderIds.map((id) => sql`${id}`), sql`, `);
    const folders = await db
      .select({
        id: foldersTable.id,
        name: foldersTable.name,
        tipoNegocioName: tiposNegocioTable.name,
        marcaName: marcasTable.name,
      })
      .from(foldersTable)
      .leftJoin(tiposNegocioTable, eq(tiposNegocioTable.id, foldersTable.tipoNegocioId))
      .leftJoin(marcasTable, eq(marcasTable.id, tiposNegocioTable.marcaId))
      .where(sql`${foldersTable.id} = ANY(ARRAY[${idList}]::int[])`);

    monthlyStatus = await Promise.all(
      folders.map(async (folder) => {
        const files = await db.select().from(dataFilesTable).where(eq(dataFilesTable.folderId, folder.id));
        const monthFiles = files.filter(
          (f) => f.periodMonth === month && f.periodYear === year && f.status === "confirmed",
        );
        const latestFile = files.sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
        )[0];
        return {
          folderId: folder.id,
          folderName: folder.name,
          tipoNegocioName: folder.tipoNegocioName,
          marcaName: folder.marcaName,
          hasFileForMonth: monthFiles.length > 0,
          latestFileDate: latestFile ? latestFile.uploadedAt.toISOString() : null,
          fileCount: files.length,
        };
      }),
    );
  }

  void GetDashboardOverviewQueryParams.safeParse(req.query);

  res.json(
    GetDashboardOverviewResponse.parse({
      totalFolders,
      totalFiles,
      totalConversations,
      recentConversations,
      monthlyStatus,
    }),
  );
});

export default router;
