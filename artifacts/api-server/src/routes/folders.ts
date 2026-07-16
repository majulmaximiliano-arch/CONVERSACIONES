import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, foldersTable, folderPermissionsTable, usersTable, dataFilesTable } from "@workspace/db";
import {
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

// ── List folders — filtered by session user's permissions ─────────────────────

router.get("/folders", requireSession, async (req, res): Promise<void> => {
  const user = req.sessionUser!;

  let folders;

  if (user.role === "admin") {
    folders = await db
      .select({
        id: foldersTable.id,
        name: foldersTable.name,
        description: foldersTable.description,
        color: foldersTable.color,
        icon: foldersTable.icon,
        scope: foldersTable.scope,
        brand: foldersTable.brand,
        createdAt: foldersTable.createdAt,
        fileCount: sql<number>`count(${dataFilesTable.id})::int`,
      })
      .from(foldersTable)
      .leftJoin(dataFilesTable, eq(dataFilesTable.folderId, foldersTable.id))
      .groupBy(foldersTable.id)
      .orderBy(foldersTable.name);
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
      .select({
        id: foldersTable.id,
        name: foldersTable.name,
        description: foldersTable.description,
        color: foldersTable.color,
        icon: foldersTable.icon,
        scope: foldersTable.scope,
        brand: foldersTable.brand,
        createdAt: foldersTable.createdAt,
        fileCount: sql<number>`count(${dataFilesTable.id})::int`,
      })
      .from(foldersTable)
      .leftJoin(dataFilesTable, eq(dataFilesTable.folderId, foldersTable.id))
      .where(sql`${foldersTable.id} = ANY(ARRAY[${sql.join(folderIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      .groupBy(foldersTable.id)
      .orderBy(foldersTable.name);
  }

  res.json(ListFoldersResponse.parse(folders));
});

router.post("/folders", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [folder] = await db.insert(foldersTable).values(parsed.data).returning();
  res.status(201).json(CreateFolderResponse.parse({ ...folder, fileCount: 0 }));
});

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

  const [folder] = await db.select().from(foldersTable).where(eq(foldersTable.id, params.data.folderId));
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

  const [{ fileCount }] = await db
    .select({ fileCount: sql<number>`count(*)::int` })
    .from(dataFilesTable)
    .where(eq(dataFilesTable.folderId, folder.id));

  res.json(UpdateFolderResponse.parse({ ...folder, fileCount }));
});

router.delete("/folders/:folderId", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(foldersTable).where(eq(foldersTable.id, params.data.folderId));
  res.sendStatus(204);
});

// ── Folder Permissions — admin only ──────────────────────────────────────────

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
