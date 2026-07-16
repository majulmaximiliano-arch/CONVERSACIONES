import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  foldersTable,
  dataFilesTable,
  conversationsTable,
  messagesTable,
  folderPermissionsTable,
} from "@workspace/db";
import {
  GetMonthlyStatusQueryParams,
  GetMonthlyStatusResponse,
  GetDashboardOverviewQueryParams,
  GetDashboardOverviewResponse,
} from "@workspace/api-zod";
import { requireSession } from "../middleware/auth";

const router: IRouter = Router();

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

  let folders;
  if (user.role === "admin") {
    folders = await db.select().from(foldersTable).orderBy(foldersTable.name);
  } else {
    const permissions = await db
      .select({ folderId: folderPermissionsTable.folderId })
      .from(folderPermissionsTable)
      .where(eq(folderPermissionsTable.userId, user.id));
    const folderIds = permissions.map((p) => p.folderId);

    if (folderIds.length === 0) {
      res.json([]);
      return;
    }

    folders = await db
      .select()
      .from(foldersTable)
      .where(sql`${foldersTable.id} = ANY(ARRAY[${sql.join(folderIds.map((id) => sql`${id}`), sql`, `)}]::int[])`);
  }

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

  // Get folder IDs accessible to this user
  let folderIds: number[];
  if (user.role === "admin") {
    const allFolders = await db.select({ id: foldersTable.id }).from(foldersTable);
    folderIds = allFolders.map((f) => f.id);
  } else {
    const userFolders = await db
      .select({ folderId: folderPermissionsTable.folderId })
      .from(folderPermissionsTable)
      .where(eq(folderPermissionsTable.userId, user.id));
    folderIds = userFolders.map((f) => f.folderId);
  }

  const totalFolders = folderIds.length;

  let totalFiles = 0;
  if (folderIds.length > 0) {
    const fileCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dataFilesTable)
      .where(sql`${dataFilesTable.folderId} = ANY(ARRAY[${sql.join(folderIds.map((id) => sql`${id}`), sql`, `)}]::int[])`);
    totalFiles = fileCountResult[0]?.count ?? 0;
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

  let monthlyStatus: Array<{
    folderId: number;
    folderName: string;
    hasFileForMonth: boolean;
    latestFileDate: string | null;
    fileCount: number;
  }> = [];

  if (folderIds.length > 0) {
    const folders = await db
      .select()
      .from(foldersTable)
      .where(sql`${foldersTable.id} = ANY(ARRAY[${sql.join(folderIds.map((id) => sql`${id}`), sql`, `)}]::int[])`);

    monthlyStatus = await Promise.all(
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
          hasFileForMonth: monthFiles.length > 0,
          latestFileDate: latestFile ? latestFile.uploadedAt.toISOString() : null,
          fileCount: files.length,
        };
      }),
    );
  }

  // Ignore the userId query param — always use session identity
  const params = GetDashboardOverviewQueryParams.safeParse(req.query);
  void params; // parsed but not used; userId comes from session

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
