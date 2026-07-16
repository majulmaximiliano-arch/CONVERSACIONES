import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// ── Marcas (brands — top level) ───────────────────────────────────────────────

export const marcasTable = pgTable("marcas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Tipos de Negocio (business types — within a Marca) ────────────────────────

export const tiposNegocioTable = pgTable("tipos_negocio", {
  id: serial("id").primaryKey(),
  marcaId: integer("marca_id").notNull().references(() => marcasTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Carpetas / Folders (within a Tipo de Negocio) ─────────────────────────────

export const foldersTable = pgTable("folders", {
  id: serial("id").primaryKey(),
  tipoNegocioId: integer("tipo_negocio_id").notNull().references(() => tiposNegocioTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  icon: text("icon"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Folder Permissions (carpeta-level access control) ─────────────────────────

export const folderPermissionsTable = pgTable("folder_permissions", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").notNull().references(() => foldersTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Marca Permissions (marca-level access control — prepared for future UI) ───

export const userMarcaPermissionsTable = pgTable("user_marca_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  marcaId: integer("marca_id").notNull().references(() => marcasTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Tipo de Negocio Permissions (prepared for future UI) ─────────────────────

export const userTipoNegocioPermissionsTable = pgTable("user_tipo_negocio_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tipoNegocioId: integer("tipo_negocio_id").notNull().references(() => tiposNegocioTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Insert schemas & types ─────────────────────────────────────────────────────

export const insertMarcaSchema = createInsertSchema(marcasTable).omit({ id: true, createdAt: true });
export const insertTipoNegocioSchema = createInsertSchema(tiposNegocioTable).omit({ id: true, createdAt: true });
export const insertFolderSchema = createInsertSchema(foldersTable).omit({ id: true, createdAt: true });
export const insertFolderPermissionSchema = createInsertSchema(folderPermissionsTable).omit({ id: true, createdAt: true });

export type InsertMarca = z.infer<typeof insertMarcaSchema>;
export type InsertTipoNegocio = z.infer<typeof insertTipoNegocioSchema>;
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Marca = typeof marcasTable.$inferSelect;
export type TipoNegocio = typeof tiposNegocioTable.$inferSelect;
export type Folder = typeof foldersTable.$inferSelect;
export type FolderPermission = typeof folderPermissionsTable.$inferSelect;
