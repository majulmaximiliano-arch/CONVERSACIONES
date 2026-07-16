import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db, foldersTable, folderPermissionsTable, usersTable,
  dataFilesTable, tiposNegocioTable, marcasTable,
} from "@workspace/db";
import {
  ListFoldersQueryParams,
  ListFoldersResponse,
  CreateFolderBody,
  CreateFolderResponse,
  GetFolderParams,
  GetFolderResponse,
  UpdateFolderParams,
  UpdateFolderBody,
  UpdateFolderResponse,
  DeleteFolderParams,
  GetFolderPermissionsParams,
  GetFolderPermissionsResponse,
  GrantFolderPermissionParams,
  GrantFolderPermissionBody,
  GrantFolderPermissionResponse,
  RevokeFolderPermissionParams,
} from "@workspace/api-zod";
import { requireSession, requireAdmin } from "../middleware/auth";
import { canAccessFolder } from "../lib/authorize";

const router: IRouter = Router();

// ── Shared select helper ──────────────────────────────────────────────────────

const folderSelect = {
  id: foldersTable.id,
  tipoNegocioId: foldersTable.tipoNegocioId,
  tipoNegocioName: tiposNegocioTable.name,
  marcaId: marcasTable.id,
  marcaName: marcasTable.name,
  name: foldersTable.name,
  description: foldersTable.description,
  color: foldersTable.color,
  icon: foldersTable.icon,
  createdAt: foldersTable.createdAt,
  fileCount: sql<number>`count(${dataFilesTable.id})::int`,
};

function folderJoins(q: ReturnType<typeof db.select>) {
  return q
    .from(foldersTable)
    .leftJoin(tiposNegocioTable, eq(tiposNegocioTable.id, foldersTable.tipoNegocioId))
    .leftJoin(marcasTable, eq(marcasTable.id, tiposNegocioTable.marcaId))
    .leftJoin(dataFilesTable, eq(dataFilesTable.folderId, foldersTable.id));
}

// ── List folders ──────────────────────────────────────────────────────────────

router.get("/folders", requireSession, async (req, res): Promise<void> => {
  const params = ListFoldersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const user = req.sessionUser!;
  const tipoFilter = params.data.tipoNegocioId;

  let folders;

  if (user.role === "admin") {
    const q = db.select(folderSelect);
    const joined = folderJoins(q as any);
    folders = await joined
      .where(tipoFilter ? eq(foldersTable.tipoNegocioId, tipoFilter) : sql`TRUE`)
      .groupBy(foldersTable.id, tiposNegocioTable.name, marcasTable.id, marcasTable.name)
      .orderBy(foldersTable.name);
  } else {
    // Hierarchical access: explicit folder permission OR tipo_negocio permission OR marca permission
    const accessible = await db.execute(sql`
      SELECT DISTINCT f.id
      FROM folders f
      LEFT JOIN tipos_negocio tn ON tn.id = f.tipo_negocio_id
      LEFT JOIN marcas m ON m.id = tn.marca_id
      WHERE
        EXISTS (SELECT 1 FROM folder_permissions fp WHERE fp.folder_id = f.id AND fp.user_id = ${user.id})
        OR EXISTS (SELECT 1 FROM user_tipo_negocio_permissions utp WHERE utp.tipo_negocio_id = f.tipo_negocio_id AND utp.user_id = ${user.id})
        OR EXISTS (SELECT 1 FROM user_marca_permissions ump WHERE ump.marca_id = m.id AND ump.user_id = ${user.id})
    `);

    const folderIds = (accessible.rows as any[]).map((r) => r.id as number);

    if (folderIds.length === 0) {
      res.json([]);
      return;
    }

    const q = db.select(folderSelect);
    const joined = folderJoins(q as any);
    const idFilter = sql`${foldersTable.id} = ANY(ARRAY[${sql.join(folderIds.map((id) => sql`${id}`), sql`, `)}]::int[])`;
    folders = await joined
      .where(tipoFilter ? and(idFilter, eq(foldersTable.tipoNegocioId, tipoFilter)) : idFilter)
      .groupBy(foldersTable.id, tiposNegocioTable.name, marcasTable.id, marcasTable.name)
      .orderBy(foldersTable.name);
  }

  res.json(ListFoldersResponse.parse(folders));
});

// ── Create folder ─────────────────────────────────────────────────────────────

router.post("/folders", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [folder] = await db.insert(foldersTable).values(parsed.data).returning();

  const [meta] = await db
    .select({ tipoNegocioName: tiposNegocioTable.name, marcaId: marcasTable.id, marcaName: marcasTable.name })
    .from(tiposNegocioTable)
    .leftJoin(marcasTable, eq(marcasTable.id, tiposNegocioTable.marcaId))
    .where(eq(tiposNegocioTable.id, folder.tipoNegocioId));

  res.status(201).json(
    CreateFolderResponse.parse({
      ...folder,
      tipoNegocioName: meta?.tipoNegocioName ?? "",
      marcaId: meta?.marcaId ?? 0,
      marcaName: meta?.marcaName ?? "",
      fileCount: 0,
    }),
  );
});

// ── Get folder ────────────────────────────────────────────────────────────────

router.get("/folders/:folderId", requireSession, async (req, res): Promise<void> => {
  const params = GetFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (!(await canAccessFolder(req.sessionUser!, params.data.folderId))) {
    res.status(403).json({ error: "Sin acceso a esta carpeta" });
    return;
  }

  const [folder] = await db
    .select({
      id: foldersTable.id,
      tipoNegocioId: foldersTable.tipoNegocioId,
      tipoNegocioName: tiposNegocioTable.name,
      marcaId: marcasTable.id,
      marcaName: marcasTable.name,
      name: foldersTable.name,
      description: foldersTable.description,
      color: foldersTable.color,
      icon: foldersTable.icon,
      createdAt: foldersTable.createdAt,
    })
    .from(foldersTable)
    .leftJoin(tiposNegocioTable, eq(tiposNegocioTable.id, foldersTable.tipoNegocioId))
    .leftJoin(marcasTable, eq(marcasTable.id, tiposNegocioTable.marcaId))
    .where(eq(foldersTable.id, params.data.folderId));

  if (!folder) {
    res.status(404).json({ error: "Carpeta no encontrada" });
    return;
  }

  const files = await db
    .select()
    .from(dataFilesTable)
    .where(eq(dataFilesTable.folderId, params.data.folderId))
    .orderBy(dataFilesTable.uploadedAt);

  const permissions = await db
    .select({
      folderId: folderPermissionsTable.folderId,
      userId: folderPermissionsTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(folderPermissionsTable)
    .leftJoin(usersTable, eq(usersTable.id, folderPermissionsTable.userId))
    .where(eq(folderPermissionsTable.folderId, params.data.folderId));

  res.json(GetFolderResponse.parse({ ...folder, files, permissions }));
});

// ── Update folder ─────────────────────────────────────────────────────────────

router.patch("/folders/:folderId", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [folder] = await db
    .update(foldersTable)
    .set(parsed.data)
    .where(eq(foldersTable.id, params.data.folderId))
    .returning();

  if (!folder) {
    res.status(404).json({ error: "Carpeta no encontrada" });
    return;
  }

  const [meta] = await db
    .select({ tipoNegocioName: tiposNegocioTable.name, marcaId: marcasTable.id, marcaName: marcasTable.name })
    .from(tiposNegocioTable)
    .leftJoin(marcasTable, eq(marcasTable.id, tiposNegocioTable.marcaId))
    .where(eq(tiposNegocioTable.id, folder.tipoNegocioId));

  const [{ fileCount }] = await db
    .select({ fileCount: sql<number>`count(*)::int` })
    .from(dataFilesTable)
    .where(eq(dataFilesTable.folderId, folder.id));

  res.json(
    UpdateFolderResponse.parse({
      ...folder,
      tipoNegocioName: meta?.tipoNegocioName ?? "",
      marcaId: meta?.marcaId ?? 0,
      marcaName: meta?.marcaName ?? "",
      fileCount,
    }),
  );
});

// ── Delete folder ─────────────────────────────────────────────────────────────

router.delete("/folders/:folderId", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(foldersTable).where(eq(foldersTable.id, params.data.folderId));
  res.sendStatus(204);
});

// ── Folder Permissions ────────────────────────────────────────────────────────

router.get("/folders/:folderId/permissions", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = GetFolderPermissionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const permissions = await db
    .select({
      folderId: folderPermissionsTable.folderId,
      userId: folderPermissionsTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(folderPermissionsTable)
    .leftJoin(usersTable, eq(usersTable.id, folderPermissionsTable.userId))
    .where(eq(folderPermissionsTable.folderId, params.data.folderId));

  res.json(GetFolderPermissionsResponse.parse(permissions));
});

router.post("/folders/:folderId/permissions", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = GrantFolderPermissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = GrantFolderPermissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  const existing = await db
    .select()
    .from(folderPermissionsTable)
    .where(
      and(
        eq(folderPermissionsTable.folderId, params.data.folderId),
        eq(folderPermissionsTable.userId, parsed.data.userId),
      ),
    );

  if (existing.length === 0) {
    await db.insert(folderPermissionsTable).values({
      folderId: params.data.folderId,
      userId: parsed.data.userId,
    });
  }

  res.status(201).json(
    GrantFolderPermissionResponse.parse({
      folderId: params.data.folderId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    }),
  );
});

router.delete("/folders/:folderId/permissions/:userId", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = RevokeFolderPermissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(folderPermissionsTable)
    .where(
      and(
        eq(folderPermissionsTable.folderId, params.data.folderId),
        eq(folderPermissionsTable.userId, params.data.userId),
      ),
    );

  res.sendStatus(204);
});

export default router;
