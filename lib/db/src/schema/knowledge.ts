import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { foldersTable } from "./folders";

export const knowledgeConceptsTable = pgTable("knowledge_concepts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  formula: text("formula"),
});

export const conceptMappingsTable = pgTable("concept_mappings", {
  id: serial("id").primaryKey(),
  conceptId: integer("concept_id").notNull().references(() => knowledgeConceptsTable.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => foldersTable.id, { onDelete: "set null" }),
  folderName: text("folder_name").notNull(),
  columnName: text("column_name").notNull(),
  role: text("role").notNull(),
});

export const insertKnowledgeConceptSchema = createInsertSchema(knowledgeConceptsTable).omit({ id: true });
export type InsertKnowledgeConcept = z.infer<typeof insertKnowledgeConceptSchema>;
export type KnowledgeConcept = typeof knowledgeConceptsTable.$inferSelect;
export type ConceptMapping = typeof conceptMappingsTable.$inferSelect;
