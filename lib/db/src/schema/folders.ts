import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const folderScopeEnum = pgEnum("folder_scope", ["market", "brand"]);

export const foldersTable = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  icon: text("icon"),
  scope: folderScopeEnum("scope").notNull().default("market"),
  brand: text("brand"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const folderPermissionsTable = pgTable("folder_permissions", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").notNull().references(() => foldersTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFolderSchema = createInsertSchema(foldersTable).omit({ id: true, createdAt: true });
export const insertFolderPermissionSchema = createInsertSchema(folderPermissionsTable).omit({ id: true, createdAt: true });
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof foldersTable.$inferSelect;
export type FolderPermission = typeof folderPermissionsTable.$inferSelect;
