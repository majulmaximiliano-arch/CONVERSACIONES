import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, knowledgeConceptsTable, conceptMappingsTable } from "@workspace/db";
import {
  ListKnowledgeConceptsResponse,
  GetKnowledgeConceptParams,
  GetKnowledgeConceptResponse,
} from "@workspace/api-zod";
import { requireSession } from "../middleware/auth";

const router: IRouter = Router();

// Knowledge catalog is readable by any authenticated user
router.get("/knowledge-catalog", requireSession, async (_req, res): Promise<void> => {
  const concepts = await db.select().from(knowledgeConceptsTable).orderBy(knowledgeConceptsTable.category);
  res.json(ListKnowledgeConceptsResponse.parse(concepts));
});

router.get("/knowledge-catalog/:conceptId", requireSession, async (req, res): Promise<void> => {
  const params = GetKnowledgeConceptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [concept] = await db
    .select()
    .from(knowledgeConceptsTable)
    .where(eq(knowledgeConceptsTable.id, params.data.conceptId));

  if (!concept) {
    res.status(404).json({ error: "Concepto no encontrado" });
    return;
  }

  const mappings = await db
    .select()
    .from(conceptMappingsTable)
    .where(eq(conceptMappingsTable.conceptId, concept.id));

  res.json(GetKnowledgeConceptResponse.parse({ ...concept, columnMappings: mappings }));
});

export default router;
