import { and, eq } from "drizzle-orm";
import { db, folderPermissionsTable, dataFilesTable, conversationsTable } from "@workspace/db";
import type { User } from "@workspace/db";

/**
 * Returns true if the user can read from the given folder.
 * Admins always have access. Analysts need an explicit permission record.
 */
export async function canAccessFolder(user: User, folderId: number): Promise<boolean> {
  if (user.role === "admin") return true;

  const [perm] = await db
    .select()
    .from(folderPermissionsTable)
    .where(
      and(
        eq(folderPermissionsTable.folderId, folderId),
        eq(folderPermissionsTable.userId, user.id),
      ),
    );

  return !!perm;
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
