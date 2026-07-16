import { pgTable, serial, text, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { foldersTable } from "./folders";
import { usersTable } from "./users";

export const fileStatusEnum = pgEnum("file_status", ["pending", "confirmed"]);
export const columnTypeEnum = pgEnum("column_type", ["number", "date", "category", "percentage", "text"]);

export const dataFilesTable = pgTable("data_files", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").notNull().references(() => foldersTable.id, { onDelete: "cascade" }),
  originalFilename: text("original_filename").notNull(),
  storedFilename: text("stored_filename").notNull(),
  description: text("description"),
  brand: text("brand"),
  periodMonth: integer("period_month"),
  periodYear: integer("period_year"),
  status: fileStatusEnum("status").notNull().default("pending"),
  uploadedBy: integer("uploaded_by").notNull().references(() => usersTable.id),
  rowCount: integer("row_count"),
  sheetCount: integer("sheet_count"),
  columnCount: integer("column_count"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fileColumnsTable = pgTable("file_columns", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull().references(() => dataFilesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  detectedType: columnTypeEnum("detected_type").notNull().default("text"),
  isMetric: integer("is_metric").notNull().default(0),
  isDimension: integer("is_dimension").notNull().default(0),
  sampleValues: jsonb("sample_values").$type<string[]>().default([]),
});

export const dataRowsTable = pgTable("data_rows", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull().references(() => dataFilesTable.id, { onDelete: "cascade" }),
  sheetName: text("sheet_name"),
  rowData: jsonb("row_data").notNull().$type<Record<string, unknown>>(),
});

export const insertDataFileSchema = createInsertSchema(dataFilesTable).omit({ id: true, uploadedAt: true });
export const insertFileColumnSchema = createInsertSchema(fileColumnsTable).omit({ id: true });
export type InsertDataFile = z.infer<typeof insertDataFileSchema>;
export type DataFile = typeof dataFilesTable.$inferSelect;
export type FileColumn = typeof fileColumnsTable.$inferSelect;
export type DataRow = typeof dataRowsTable.$inferSelect;
