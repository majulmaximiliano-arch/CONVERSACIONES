import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, tiposNegocioTable, marcasTable, foldersTable } from "@workspace/db";
import {
  ListTiposNegocioParams,
  ListTiposNegocioResponse,
  CreateTipoNegocioParams,
  CreateTipoNegocioBody,
  CreateTipoNegocioResponse,
  UpdateTipoNegocioParams,
  UpdateTipoNegocioBody,
  UpdateTipoNegocioResponse,
  DeleteTipoNegocioParams,
} from "@workspace/api-zod";
import { requireSession, requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

// ── List tipos de negocio for a marca ────────────────────────────────────────

router.get("/marcas/:marcaId/tipos-negocio", requireSession, async (req, res): Promise<void> => {
  const params = ListTiposNegocioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tipos = await db
    .select({
      id: tiposNegocioTable.id,
      marcaId: tiposNegocioTable.marcaId,
      marcaName: marcasTable.name,
      name: tiposNegocioTable.name,
      folderCount: sql<number>`count(${foldersTable.id})::int`,
      createdAt: tiposNegocioTable.createdAt,
    })
    .from(tiposNegocioTable)
    .leftJoin(marcasTable, eq(marcasTable.id, tiposNegocioTable.marcaId))
    .leftJoin(foldersTable, eq(foldersTable.tipoNegocioId, tiposNegocioTable.id))
    .where(eq(tiposNegocioTable.marcaId, params.data.marcaId))
    .groupBy(tiposNegocioTable.id, marcasTable.name)
    .orderBy(tiposNegocioTable.name);

  res.json(ListTiposNegocioResponse.parse(tipos));
});

// ── Create tipo de negocio ────────────────────────────────────────────────────

router.post("/marcas/:marcaId/tipos-negocio", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = CreateTipoNegocioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateTipoNegocioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [marca] = await db.select().from(marcasTable).where(eq(marcasTable.id, params.data.marcaId));
  if (!marca) {
    res.status(404).json({ error: "Marca no encontrada" });
    return;
  }

  const [tipo] = await db
    .insert(tiposNegocioTable)
    .values({ marcaId: params.data.marcaId, name: parsed.data.name })
    .returning();

  res.status(201).json(
    CreateTipoNegocioResponse.parse({
      ...tipo,
      marcaName: marca.name,
      folderCount: 0,
    }),
  );
});

// ── Update tipo de negocio ────────────────────────────────────────────────────

router.patch("/marcas/:marcaId/tipos-negocio/:tipoNegocioId", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateTipoNegocioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTipoNegocioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [tipo] = await db
    .update(tiposNegocioTable)
    .set(parsed.data)
    .where(
      and(
        eq(tiposNegocioTable.id, params.data.tipoNegocioId),
        eq(tiposNegocioTable.marcaId, params.data.marcaId),
      ),
    )
    .returning();

  if (!tipo) {
    res.status(404).json({ error: "Tipo de negocio no encontrado" });
    return;
  }

  const [marca] = await db.select().from(marcasTable).where(eq(marcasTable.id, tipo.marcaId));
  const [{ folderCount }] = await db
    .select({ folderCount: sql<number>`count(*)::int` })
    .from(foldersTable)
    .where(eq(foldersTable.tipoNegocioId, tipo.id));

  res.json(
    UpdateTipoNegocioResponse.parse({
      ...tipo,
      marcaName: marca?.name ?? "",
      folderCount,
    }),
  );
});

// ── Delete tipo de negocio ────────────────────────────────────────────────────

router.delete("/marcas/:marcaId/tipos-negocio/:tipoNegocioId", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteTipoNegocioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(tiposNegocioTable)
    .where(
      and(
        eq(tiposNegocioTable.id, params.data.tipoNegocioId),
        eq(tiposNegocioTable.marcaId, params.data.marcaId),
      ),
    );

  res.sendStatus(204);
});

export default router;
