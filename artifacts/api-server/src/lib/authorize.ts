import { eq, sql } from "drizzle-orm";
import { db, dataFilesTable, conversationsTable, foldersTable } from "@workspace/db";
import type { User } from "@workspace/db";

/**
 * Returns true if the user can access the given folder.
 * Admins always have access.
 * Analysts need an explicit permission at folder, tipo_negocio, or marca level.
 */
export async function canAccessFolder(user: User, folderId: number): Promise<boolean> {
  if (user.role === "admin") return true;

  const result = await db.execute(sql`
    SELECT 1
    FROM folders f
    LEFT JOIN tipos_negocio tn ON tn.id = f.tipo_negocio_id
    LEFT JOIN marcas m ON m.id = tn.marca_id
    WHERE f.id = ${folderId}
      AND (
        EXISTS (SELECT 1 FROM folder_permissions fp WHERE fp.folder_id = f.id AND fp.user_id = ${user.id})
        OR EXISTS (SELECT 1 FROM user_tipo_negocio_permissions utp WHERE utp.tipo_negocio_id = f.tipo_negocio_id AND utp.user_id = ${user.id})
        OR EXISTS (SELECT 1 FROM user_marca_permissions ump WHERE ump.marca_id = m.id AND ump.user_id = ${user.id})
      )
    LIMIT 1
  `);

  return result.rows.length > 0;
}

/**
 * Returns the file if the user can access its folder, null otherwise.
 */
export async function canAccessFile(user: User, fileId: number) {
  const [file] = await db.select().from(dataFilesTable).where(eq(dataFilesTable.id, fileId));
  if (!file) return null;

  const allowed = await canAccessFolder(user, file.folderId);
  return allowed ? file : null;
}

/**
 * Returns the conversation if it belongs to the user (or user is admin), null otherwise.
 */
export async function canAccessConversation(user: User, conversationId: number) {
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, conversationId));

  if (!conversation) return null;
  if (user.role === "admin" || conversation.userId === user.id) return conversation;
  return null;
}
