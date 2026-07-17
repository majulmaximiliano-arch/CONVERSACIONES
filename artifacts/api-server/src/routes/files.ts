import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, dataFilesTable, fileColumnsTable, dataRowsTable, foldersTable } from "@workspace/db";
import {
  GetFileParams,
  GetFileResponse,
  DeleteFileParams,
  ConfirmFileParams,
  ConfirmFileBody,
  ConfirmFileResponse,
  ListFolderFilesParams,
  ListFolderFilesResponse,
} from "@workspace/api-zod";
import { requireSession, requireAdmin } from "../middleware/auth";
import { canAccessFolder, canAccessFile } from "../lib/authorize";
import { parseExcelFile } from "../lib/excel-parser";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sanitize an Excel column name to a valid PostgreSQL identifier */
function sanitizeColName(name: string): string {
  const s = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accent marks (é→e, ñ→n, etc.)
    .replace(/[^a-z0-9]/g, "_")      // non-alphanumeric → underscore
    .replace(/^(\d)/, "_$1")         // leading digit gets prefixed
    .replace(/_+/g, "_")             // collapse repeated underscores
    .replace(/^_+|_+$/g, "")         // trim leading/trailing underscores
    .slice(0, 63);                   // PostgreSQL max identifier length
  return s || "col";
}

interface ColumnSchema {
  originalName: string;
  sanitizedName: string;
  detectedType: string;
}

/** Build sanitized column schema, deduplicating collisions */
function buildColumnSchema(columns: { name: string; detectedType: string }[]): ColumnSchema[] {
  const seen = new Map<string, number>();
  return columns.map((col) => {
    let sanitized = sanitizeColName(col.name);
    const count = seen.get(sanitized) ?? 0;
    seen.set(sanitized, count + 1);
    if (count > 0) sanitized = `${sanitized}_${count}`;
    return { originalName: col.name, sanitizedName: sanitized, detectedType: col.detectedType };
  });
}

/** Create a dynamic PostgreSQL table for a file and bulk-insert all its rows */
async function createFileTable(tableName: string, columnSchema: ColumnSchema[], rows: Record<string, unknown>[]): Promise<void> {
  const colDefs = columnSchema.map((c) => `"${c.sanitizedName}" text`).join(", ");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ${tableName} (_row_id serial PRIMARY KEY, ${colDefs})`));

  if (rows.length === 0) return;

  const colList = sql.raw(columnSchema.map((c) => `"${c.sanitizedName}"`).join(", "));
  const BATCH = 200;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const rowClauses = batch.map((row) => {
      const vals = columnSchema.map((c) => {
        const v = row[c.originalName];
        return v === null || v === undefined ? sql`NULL` : sql`${String(v)}`;
      });
      return sql`(${sql.join(vals, sql`, `)})`;
    });
    await db.execute(sql`INSERT INTO ${sql.raw(tableName)} (${colList}) VALUES ${sql.join(rowClauses, sql`, `)}`);
  }
}

// ── List files in a folder ────────────────────────────────────────────────────

router.get("/folders/:folderId/files", requireSession, async (req, res): Promise<void> => {
  const params = ListFolderFilesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (!(await canAccessFolder(req.sessionUser!, params.data.folderId))) {
    res.status(403).json({ error: "Sin acceso a esta carpeta" });
    return;
  }

  const files = await db
    .select()
    .from(dataFilesTable)
    .where(eq(dataFilesTable.folderId, params.data.folderId))
    .orderBy(dataFilesTable.uploadedAt);

  res.json(ListFolderFilesResponse.parse(files));
});

// ── Upload file ───────────────────────────────────────────────────────────────

router.post("/folders/:folderId/upload", requireSession, upload.single("file"), async (req, res): Promise<void> => {
  const rawFolderId = Array.isArray(req.params.folderId) ? req.params.folderId[0] : req.params.folderId;
  const folderId = parseInt(rawFolderId, 10);

  if (isNaN(folderId)) {
    res.status(400).json({ error: "folderId inválido" });
    return;
  }

  if (!(await canAccessFolder(req.sessionUser!, folderId))) {
    res.status(403).json({ error: "Sin acceso a esta carpeta" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "Se requiere un archivo Excel" });
    return;
  }

  const [folder] = await db.select().from(foldersTable).where(eq(foldersTable.id, folderId));
  if (!folder) {
    res.status(404).json({ error: "Carpeta no encontrada" });
    return;
  }

  let parsed;
  try {
    parsed = parseExcelFile(req.file.buffer, req.file.originalname);
  } catch {
    res.status(400).json({ error: "No se pudo procesar el archivo Excel" });
    return;
  }

  const firstSheet = parsed.sheets[0];
  const period = extractPeriod(parsed.detectedPeriod);

  const [dataFile] = await db
    .insert(dataFilesTable)
    .values({
      folderId,
      originalFilename: req.file.originalname,
      storedFilename: req.file.originalname,
      description: req.body.description ?? null,
      brand: parsed.detectedBrand ?? req.body.brand ?? null,
      periodMonth: period.month,
      periodYear: period.year,
      status: "pending",
      uploadedBy: req.sessionUser!.id,
      rowCount: parsed.totalRows,
      sheetCount: parsed.sheets.length,
      columnCount: firstSheet?.columns.length ?? 0,
    })
    .returning();

  if (firstSheet) {
    // Insert column metadata
    const columnInserts = firstSheet.columns.map((col) => ({
      fileId: dataFile.id,
      name: col.name,
      detectedType: col.detectedType,
      isMetric: col.isMetric ? 1 : 0,
      isDimension: col.isDimension ? 1 : 0,
      sampleValues: col.sampleValues,
    }));
    const insertedColumns = await db.insert(fileColumnsTable).values(columnInserts).returning();

    // Build column schema for dynamic table
    const columnSchema = buildColumnSchema(firstSheet.columns);
    const tableName = `file_data_${dataFile.id}`;

    // Create dynamic PostgreSQL table and insert ALL rows (no limit)
    try {
      await createFileTable(tableName, columnSchema, firstSheet.rows);

      // Update file record with table metadata
      await db
        .update(dataFilesTable)
        .set({ tableName, columnSchema })
        .where(eq(dataFilesTable.id, dataFile.id));
    } catch (tableErr) {
      // Table creation failure is non-fatal — log and continue without it
      console.error(`[upload] Failed to create dynamic table for file ${dataFile.id}:`, tableErr);
    }

    // Also store first 1000 rows in data_rows for preview/fallback
    const rowsToInsert = firstSheet.rows.slice(0, 1000).map((row) => ({
      fileId: dataFile.id,
      sheetName: firstSheet.name,
      rowData: row as Record<string, unknown>,
    }));
    if (rowsToInsert.length > 0) {
      await db.insert(dataRowsTable).values(rowsToInsert);
    }

    res.status(201).json({
      file: dataFile,
      sheets: parsed.sheets.map((s) => s.name),
      columns: insertedColumns.map((c) => ({
        ...c,
        isMetric: c.isMetric === 1,
        isDimension: c.isDimension === 1,
      })),
      detectedPeriod: parsed.detectedPeriod,
      detectedBrand: parsed.detectedBrand,
      metricCount: firstSheet.columns.filter((c) => c.isMetric).length,
      dimensionCount: firstSheet.columns.filter((c) => c.isDimension).length,
      rowCount: parsed.totalRows,
      summary: parsed.summary,
    });
  } else {
    res.status(201).json({
      file: dataFile,
      sheets: [],
      columns: [],
      detectedPeriod: null,
      detectedBrand: null,
      metricCount: 0,
      dimensionCount: 0,
      rowCount: 0,
      summary: "Archivo vacío",
    });
  }
});

// ── Get file detail ───────────────────────────────────────────────────────────

router.get("/files/:fileId", requireSession, async (req, res): Promise<void> => {
  const params = GetFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const file = await canAccessFile(req.sessionUser!, params.data.fileId);
  if (!file) {
    res.status(404).json({ error: "Archivo no encontrado" });
    return;
  }

  const columns = await db.select().from(fileColumnsTable).where(eq(fileColumnsTable.fileId, file.id));
  const previewRows = await db
    .select()
    .from(dataRowsTable)
    .where(eq(dataRowsTable.fileId, file.id))
    .limit(10);

  res.json(
    GetFileResponse.parse({
      ...file,
      columns: columns.map((c) => ({
        ...c,
        isMetric: c.isMetric === 1,
        isDimension: c.isDimension === 1,
      })),
      previewRows: previewRows.map((r) => r.rowData),
    }),
  );
});

// ── Confirm file ──────────────────────────────────────────────────────────────

router.post("/files/:fileId/confirm", requireSession, async (req, res): Promise<void> => {
  const params = ConfirmFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const file = await canAccessFile(req.sessionUser!, params.data.fileId);
  if (!file) {
    res.status(404).json({ error: "Archivo no encontrado" });
    return;
  }

  const parsed = ConfirmFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof dataFilesTable.$inferInsert> = { status: "confirmed" };
  if (parsed.data.description != null) updates.description = parsed.data.description;
  if (parsed.data.brand != null) updates.brand = parsed.data.brand;
  if (parsed.data.periodMonth != null) updates.periodMonth = parsed.data.periodMonth;
  if (parsed.data.periodYear != null) updates.periodYear = parsed.data.periodYear;

  const [updatedFile] = await db
    .update(dataFilesTable)
    .set(updates)
    .where(eq(dataFilesTable.id, params.data.fileId))
    .returning();

  if (parsed.data.columns && parsed.data.columns.length > 0) {
    const ownedColumns = await db
      .select({ id: fileColumnsTable.id })
      .from(fileColumnsTable)
      .where(eq(fileColumnsTable.fileId, file.id));
    const ownedIds = new Set(ownedColumns.map((c) => c.id));

    for (const col of parsed.data.columns) {
      if (!ownedIds.has(col.id)) {
        res.status(403).json({ error: `La columna ${col.id} no pertenece a este archivo` });
        return;
      }
      const colUpdates: Partial<typeof fileColumnsTable.$inferInsert> = {};
      if (col.detectedType != null) colUpdates.detectedType = col.detectedType;
      if (col.isMetric != null) colUpdates.isMetric = col.isMetric ? 1 : 0;
      if (col.isDimension != null) colUpdates.isDimension = col.isDimension ? 1 : 0;
      if (Object.keys(colUpdates).length > 0) {
        await db
          .update(fileColumnsTable)
          .set(colUpdates)
          .where(and(eq(fileColumnsTable.id, col.id), eq(fileColumnsTable.fileId, file.id)));
      }
    }
  }

  const columns = await db.select().from(fileColumnsTable).where(eq(fileColumnsTable.fileId, file.id));
  const previewRows = await db
    .select()
    .from(dataRowsTable)
    .where(eq(dataRowsTable.fileId, file.id))
    .limit(10);

  res.json(
    ConfirmFileResponse.parse({
      ...updatedFile,
      columns: columns.map((c) => ({ ...c, isMetric: c.isMetric === 1, isDimension: c.isDimension === 1 })),
      previewRows: previewRows.map((r) => r.rowData),
    }),
  );
});

// ── Delete file ───────────────────────────────────────────────────────────────

router.delete("/files/:fileId", requireSession, async (req, res): Promise<void> => {
  const params = DeleteFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const file = await canAccessFile(req.sessionUser!, params.data.fileId);
  if (!file) {
    res.status(404).json({ error: "Archivo no encontrado" });
    return;
  }

  // Drop the dynamic table if it exists
  if (file.tableName) {
    try {
      await db.execute(sql.raw(`DROP TABLE IF EXISTS ${file.tableName}`));
    } catch {
      // non-fatal
    }
  }

  await db.delete(dataFilesTable).where(eq(dataFilesTable.id, params.data.fileId));
  res.sendStatus(204);
});

// ── Period extraction ─────────────────────────────────────────────────────────

function extractPeriod(label: string | null): { month: number | null; year: number | null } {
  if (!label) return { month: null, year: null };
  const yearMatch = label.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  const months: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  };
  const lower = label.toLowerCase();
  let month: number | null = null;
  for (const [name, num] of Object.entries(months)) {
    if (lower.includes(name)) { month = num; break; }
  }

  return { month, year };
}

export default router;
