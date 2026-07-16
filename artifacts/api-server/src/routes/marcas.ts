import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, marcasTable, tiposNegocioTable } from "@workspace/db";
import {
  ListMarcasQueryParams,
  ListMarcasResponse,
  CreateMarcaBody,
  CreateMarcaResponse,
  GetMarcaParams,
  GetMarcaResponse,
  UpdateMarcaParams,
  UpdateMarcaBody,
  UpdateMarcaResponse,
  DeleteMarcaParams,
} from "@workspace/api-zod";
import { requireSession, requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

// ── List marcas ───────────────────────────────────────────────────────────────

router.get("/marcas", requireSession, async (req, res): Promise<void> => {
  const params = ListMarcasQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const marcas = await db
    .select({
      id: marcasTable.id,
      name: marcasTable.name,
      slug: marcasTable.slug,
      logoUrl: marcasTable.logoUrl,
      isActive: marcasTable.isActive,
      tipoNegocioCount: sql<number>`count(${tiposNegocioTable.id})::int`,
      createdAt: marcasTable.createdAt,
    })
    .from(marcasTable)
    .leftJoin(tiposNegocioTable, eq(tiposNegocioTable.marcaId, marcasTable.id))
    .where(
      params.data.activeOnly === true ? eq(marcasTable.isActive, true) : sql`TRUE`
    )
    .groupBy(marcasTable.id)
    .orderBy(marcasTable.name);

  res.json(ListMarcasResponse.parse(marcas));
});

// ── Create marca ──────────────────────────────────────────────────────────────

router.post("/marcas", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateMarcaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [marca] = await db.insert(marcasTable).values(parsed.data).returning();
  res.status(201).json(CreateMarcaResponse.parse({ ...marca, tipoNegocioCount: 0 }));
});

// ── Get marca ─────────────────────────────────────────────────────────────────

router.get("/marcas/:marcaId", requireSession, async (req, res): Promise<void> => {
  const params = GetMarcaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [result] = await db
    .select({
      id: marcasTable.id,
      name: marcasTable.name,
      slug: marcasTable.slug,
      logoUrl: marcasTable.logoUrl,
      isActive: marcasTable.isActive,
      tipoNegocioCount: sql<number>`count(${tiposNegocioTable.id})::int`,
      createdAt: marcasTable.createdAt,
    })
    .from(marcasTable)
    .leftJoin(tiposNegocioTable, eq(tiposNegocioTable.marcaId, marcasTable.id))
    .where(eq(marcasTable.id, params.data.marcaId))
    .groupBy(marcasTable.id);

  if (!result) {
    res.status(404).json({ error: "Marca no encontrada" });
    return;
  }

  res.json(GetMarcaResponse.parse(result));
});

// ── Update marca ──────────────────────────────────────────────────────────────

router.patch("/marcas/:marcaId", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateMarcaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMarcaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [marca] = await db
    .update(marcasTable)
    .set(parsed.data)
    .where(eq(marcasTable.id, params.data.marcaId))
    .returning();

  if (!marca) {
    res.status(404).json({ error: "Marca no encontrada" });
    return;
  }

  const [{ tipoNegocioCount }] = await db
    .select({ tipoNegocioCount: sql<number>`count(*)::int` })
    .from(tiposNegocioTable)
    .where(eq(tiposNegocioTable.marcaId, marca.id));

  res.json(UpdateMarcaResponse.parse({ ...marca, tipoNegocioCount }));
});

// ── Delete marca ──────────────────────────────────────────────────────────────

router.delete("/marcas/:marcaId", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteMarcaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(marcasTable).where(eq(marcasTable.id, params.data.marcaId));
  res.sendStatus(204);
});

export default router;
