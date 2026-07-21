import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  conversationsTable,
  messagesTable,
  dataFilesTable,
  fileColumnsTable,
  dataRowsTable,
  foldersTable,
} from "@workspace/db";
import { SendMessageBody, SendMessageParams } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireSession } from "../middleware/auth";
import { canAccessConversation } from "../lib/authorize";

const router: IRouter = Router();

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnSchema {
  originalName: string;
  sanitizedName: string;
  detectedType: string;
}

// ── SQL tool security ─────────────────────────────────────────────────────────

function validateSelectSql(query: string, allowedTables: Set<string>): { ok: boolean; error?: string } {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  if (!lower.startsWith("select") && !lower.startsWith("with")) {
    return { ok: false, error: "Solo se permiten queries SELECT o WITH" };
  }

  const dangerous = ["insert", "update", "delete", "drop", "create", "alter", "truncate", "grant", "revoke"];
  for (const kw of dangerous) {
    if (new RegExp(`\\b${kw}\\b`).test(lower)) {
      return { ok: false, error: `Keyword no permitido: ${kw.toUpperCase()}` };
    }
  }

  // Only allow file_data_N tables (from accessible files)
  const tablePattern = /(?:from|join)\s+"?([a-z_][a-z0-9_]*)"?/gi;
  let match;
  while ((match = tablePattern.exec(lower)) !== null) {
    const t = match[1].toLowerCase();
    if (!t.startsWith("file_data_")) {
      return { ok: false, error: `Tabla no permitida: ${t}. Solo se puede consultar tablas file_data_*.` };
    }
    if (!allowedTables.has(t)) {
      return { ok: false, error: `Tabla no accesible: ${t}` };
    }
  }

  return { ok: true };
}

async function executeSqlTool(
  query: string,
  allowedTables: Set<string>,
): Promise<{ rows: unknown[]; rowCount: number; error?: string }> {
  const validation = validateSelectSql(query, allowedTables);
  if (!validation.ok) {
    return { rows: [], rowCount: 0, error: validation.error };
  }
  try {
    const result = await db.execute(sql.raw(query));
    const rows = (result.rows as unknown[]).slice(0, 2000);
    return { rows, rowCount: result.rows.length };
  } catch (err: any) {
    return { rows: [], rowCount: 0, error: `Error SQL: ${err.message}` };
  }
}

// ── Context builders ──────────────────────────────────────────────────────────

function buildTableContext(
  filesWithSchema: Array<{ file: typeof dataFilesTable.$inferSelect; columnSchema: ColumnSchema[] }>,
): string {
  return filesWithSchema
    .map(({ file, columnSchema }) => {
      const period =
        file.periodMonth && file.periodYear
          ? `${MONTH_NAMES[file.periodMonth - 1]} ${file.periodYear}`
          : "período desconocido";
      const cols = columnSchema
        .map((c) => `    "${c.sanitizedName}" (tipo: ${c.detectedType}, columna original: "${c.originalName}")`)
        .join("\n");
      return `📊 Tabla: ${file.tableName}\n   Archivo: ${file.originalFilename} | Período: ${period}\n   Columnas:\n${cols}`;
    })
    .join("\n\n");
}

function buildSystemPrompt(
  folderNames: string[],
  tableContext: string,
  legacyContext: string,
): string {
  const hasTables = tableContext.length > 0;
  const hasLegacy = legacyContext.length > 0;

  const dataSection = hasTables
    ? `\n\nTENÉS ACCESO A LAS SIGUIENTES TABLAS DE DATOS (usá execute_sql para consultarlas):\n\n${tableContext}`
    : `\n\nCarpetas de datos disponibles: ${folderNames.join(", ") || "ninguna"}.`;

  const legacySection = hasLegacy
    ? `\n\n## Datos adicionales (archivos legacy — muestra):\n${legacyContext}`
    : "";

  const sqlRules = hasTables
    ? `
REGLAS DE SQL:
- Usá execute_sql para CUALQUIER pregunta sobre datos numéricos. No calcules de memoria.
- Todos los valores están almacenados como TEXT. Para operaciones matemáticas convertí con ::numeric
  Ejemplo: SELECT SUM(unidades::numeric) FROM file_data_5
- Para porcentajes como "15.3%" usá: REPLACE(columna, '%', '')::numeric
- Si una query falla, analizá el error e intentá corregirla.

ESTRATEGIA CLAVE — MINIMIZÁ LA CANTIDAD DE QUERIES:
Siempre intentá resolver con la menor cantidad de llamadas posible usando JOINs, CTEs y agregaciones.
Nunca hagas queries separadas para datos que podés obtener en una sola.

Ejemplos de queries eficientes:

1. Share de una marca contra el mercado (en una sola query con dos tablas):
SELECT
  SUM(vw.unidades::numeric) AS unidades_marca,
  SUM(mkt.total::numeric)   AS total_mercado,
  ROUND(100.0 * SUM(vw.unidades::numeric) / NULLIF(SUM(mkt.total::numeric), 0), 2) AS share_pct
FROM file_data_5 vw
CROSS JOIN (SELECT SUM(unidades::numeric) AS total FROM file_data_8) mkt

2. Comparar dos períodos distintos en una sola query (CTE):
WITH jun AS (SELECT SUM(unidades::numeric) AS total FROM file_data_8 WHERE periodo = 'Junio 2026'),
     ene AS (SELECT SUM(unidades::numeric) AS total FROM file_data_9 WHERE periodo = 'Enero 2026')
SELECT jun.total AS junio, ene.total AS enero,
       ROUND(100.0 * (jun.total - ene.total) / NULLIF(ene.total, 0), 2) AS variacion_pct
FROM jun, ene

3. Evolución mes a mes con UNION (cuando los datos de cada mes están en tablas separadas):
SELECT 'Enero 2026' AS periodo, SUM(unidades::numeric) AS total FROM file_data_9
UNION ALL
SELECT 'Junio 2026', SUM(unidades::numeric) FROM file_data_8
ORDER BY periodo

4. JOIN entre marca y mercado para calcular share por modelo:
SELECT v.modelo, SUM(v.unidades::numeric) AS unidades_vw,
       m.total_mercado,
       ROUND(100.0 * SUM(v.unidades::numeric) / NULLIF(m.total_mercado, 0), 2) AS share
FROM file_data_5 v
JOIN (SELECT SUM(unidades::numeric) AS total_mercado FROM file_data_8) m ON TRUE
GROUP BY v.modelo, m.total_mercado
ORDER BY unidades_vw DESC`
    : "";

  return `Sos un analista de inteligencia de negocios especializado en concesionarias automotrices.
Respondés preguntas sobre datos de ventas, postventa, finanzas y operaciones.${dataSection}${legacySection}
${sqlRules}
REGLAS GENERALES:
1. Siempre explicá el razonamiento detrás de los números. No solo mostrés datos, interpretálos.
2. Detectá anomalías, tendencias y oportunidades automáticamente.
3. Respondé SIEMPRE en español argentino.
4. Si no tenés suficientes datos para responder con certeza, decilo claramente.
5. Cuando calculés indicadores cruzados (Share, Rentabilidad, etc.), explicá el cálculo.

FORMATO DE RESPUESTA FINAL:
Cuando tengas datos suficientes para una visualización, respondé con JSON estructurado:

\`\`\`json
{
  "answer": "Tu explicación completa aquí en texto natural",
  "chart": {
    "type": "bar|line|area|pie|table",
    "title": "Título del gráfico",
    "data": [...],
    "xKey": "campo para eje X",
    "yKeys": ["campo1", "campo2"],
    "columns": [{"key": "campo", "label": "Etiqueta"}]
  },
  "kpis": [
    {"label": "Nombre KPI", "value": "1.234", "change": "+5%", "trend": "up|down|neutral"}
  ],
  "insights": [
    "Insight 1: descripción concisa",
    "Insight 2: descripción concisa"
  ]
}
\`\`\`

Si no hay datos suficientes para un gráfico, respondé solo con texto explicativo (sin JSON).`;
}

// ── Tool definition ───────────────────────────────────────────────────────────

const SQL_TOOL = {
  name: "execute_sql",
  description:
    "Ejecuta una query SQL SELECT sobre las tablas de datos de archivos cargados. " +
    "Usá esta herramienta para responder preguntas numéricas, agregaciones, comparaciones y análisis. " +
    "Los valores de columnas están almacenados como TEXT — convertí a ::numeric para aritmética.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Query SQL SELECT válida. Solo SELECT statements. No DDL ni DML.",
      },
    },
    required: ["query"],
  },
};

// ── parseAIResponse ───────────────────────────────────────────────────────────

function parseAIResponse(text: string) {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    return { answer: text };
  } catch {
    return { answer: text };
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/conversations/:conversationId/messages", requireSession, async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const user = req.sessionUser!;

  const conversation = await canAccessConversation(user, params.data.conversationId);
  if (!conversation) {
    res.status(404).json({ error: "Conversación no encontrada" });
    return;
  }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Save user message
  const [userMessage] = await db
    .insert(messagesTable)
    .values({
      conversationId: params.data.conversationId,
      role: "user",
      content: parsed.data.content,
    })
    .returning();

  // Conversation history (last 10 exchanges)
  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.conversationId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(11);

  const historyMessages = history.reverse().filter((m) => m.id !== userMessage.id);

  // Accessible folders
  let accessibleFolderIds: number[] = [];
  let folderNames: string[] = [];

  if (user.role === "admin") {
    const allFolders = await db.select({ id: foldersTable.id, name: foldersTable.name }).from(foldersTable);
    accessibleFolderIds = allFolders.map((f) => f.id);
    folderNames = allFolders.map((f) => f.name);
  } else {
    const result = await db.execute(sql`
      SELECT DISTINCT f.id, f.name
      FROM folders f
      LEFT JOIN tipos_negocio tn ON tn.id = f.tipo_negocio_id
      LEFT JOIN marcas m ON m.id = tn.marca_id
      WHERE
        EXISTS (SELECT 1 FROM folder_permissions fp WHERE fp.folder_id = f.id AND fp.user_id = ${user.id})
        OR EXISTS (SELECT 1 FROM user_tipo_negocio_permissions utp WHERE utp.tipo_negocio_id = f.tipo_negocio_id AND utp.user_id = ${user.id})
        OR EXISTS (SELECT 1 FROM user_marca_permissions ump WHERE ump.marca_id = m.id AND ump.user_id = ${user.id})
    `);
    accessibleFolderIds = (result.rows as any[]).map((r) => r.id as number);
    folderNames = (result.rows as any[]).map((r) => r.name as string);
  }

  // Fetch all confirmed files the user can access, ordered by period (most recent first)
  let files: (typeof dataFilesTable.$inferSelect)[] = [];
  if (accessibleFolderIds.length > 0) {
    const idList = sql.join(accessibleFolderIds.map((id) => sql`${id}`), sql`, `);
    files = await db
      .select()
      .from(dataFilesTable)
      .where(sql`${dataFilesTable.folderId} = ANY(ARRAY[${idList}]::int[]) AND ${dataFilesTable.status} = 'confirmed'`)
      .orderBy(
        desc(dataFilesTable.periodYear),
        desc(dataFilesTable.periodMonth),
        desc(dataFilesTable.uploadedAt),
      );
  }

  // Separate: files with dynamic tables (new) vs legacy (data_rows only)
  const filesWithTables = files
    .filter((f) => f.tableName && f.columnSchema)
    .map((f) => ({
      file: f,
      columnSchema: f.columnSchema as ColumnSchema[],
    }));

  const filesLegacy = files.filter((f) => !f.tableName);

  // Build legacy context (CSV sample from data_rows)
  const legacySections: string[] = [];
  for (const file of filesLegacy) {
    const columns = await db.select().from(fileColumnsTable).where(eq(fileColumnsTable.fileId, file.id));
    const rows = await db.select().from(dataRowsTable).where(eq(dataRowsTable.fileId, file.id)).limit(20);
    if (rows.length === 0) continue;
    const colNames = columns.map((c) => c.name).join(", ");
    const sample = rows.map((r) => JSON.stringify(r.rowData)).join("\n");
    legacySections.push(`### ${file.originalFilename}\nColumnas: ${colNames}\nMuestra:\n${sample}`);
  }
  const legacyContext = legacySections.join("\n\n");

  const tableContext = buildTableContext(filesWithTables);
  const hasTables = filesWithTables.length > 0;
  const systemPrompt = buildSystemPrompt(folderNames, tableContext, legacyContext);

  // Allowed tables for SQL security
  const allowedTables = new Set(filesWithTables.map((f) => f.file.tableName!.toLowerCase()));

  // Track which files were consulted
  const filesConsulted: string[] = files.map((f) => f.originalFilename);

  // Build initial messages
  type MsgParam = { role: "user" | "assistant"; content: any };
  const messages: MsgParam[] = [
    ...historyMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: parsed.data.content },
  ];

  // ── Agentic tool-use loop ──────────────────────────────────────────────────
  let aiResponseText = "";
  let chartData: Record<string, unknown> | null = null;
  let kpis: Array<{ label: string; value: string; change?: string; trend?: string }> = [];
  let insights: string[] = [];

  const MAX_LOOPS = 20;
  let loopCount = 0;

  try {
    while (loopCount < MAX_LOOPS) {
      loopCount++;

      const createParams: any = {
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages,
      };

      if (hasTables) {
        createParams.tools = [SQL_TOOL];
      }

      const response = await anthropic.messages.create(createParams);

      if (response.stop_reason === "tool_use") {
        // Append assistant turn with tool calls
        messages.push({ role: "assistant", content: response.content });

        // Process each tool call
        const toolResults: any[] = [];
        for (const block of response.content) {
          if (block.type === "tool_use" && block.name === "execute_sql") {
            const query = (block.input as { query: string }).query;
            const result = await executeSqlTool(query, allowedTables);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }

        // Append tool results as user turn
        messages.push({ role: "user", content: toolResults });
      } else {
        // end_turn — extract final text response
        const textBlock = response.content.find((b) => b.type === "text");
        const rawText = textBlock?.type === "text" ? textBlock.text : "";
        const parsed2 = parseAIResponse(rawText);
        aiResponseText = parsed2.answer || rawText;
        chartData = parsed2.chart || null;
        kpis = parsed2.kpis || [];
        insights = parsed2.insights || [];
        break;
      }
    }

    if (!aiResponseText) {
      // Extract any partial text Claude may have written in intermediate steps
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
      if (lastAssistantMsg && Array.isArray(lastAssistantMsg.content)) {
        const textBlock = lastAssistantMsg.content.find((b: any) => b.type === "text");
        if (textBlock?.text) {
          aiResponseText =
            textBlock.text +
            "\n\n*(Nota: el análisis se cortó antes de completarse. Si necesitás más detalle, preguntá sobre un aspecto específico.)*";
        }
      }
      if (!aiResponseText) {
        aiResponseText =
          "No pude completar el análisis en este intento. Intentá hacer la pregunta de forma más específica, por ejemplo separando en dos preguntas distintas.";
      }
    }
  } catch (err) {
    console.error("[messages] AI error:", err);
    aiResponseText = "Lo siento, hubo un error al procesar tu consulta. Por favor intentá de nuevo.";
  }

  const [assistantMessage] = await db
    .insert(messagesTable)
    .values({
      conversationId: params.data.conversationId,
      role: "assistant",
      content: aiResponseText,
      chartData,
      kpis,
      insights,
      filesConsulted,
    })
    .returning();

  // Update conversation title/timestamp
  if (historyMessages.length === 0) {
    const title = parsed.data.content.slice(0, 60) + (parsed.data.content.length > 60 ? "..." : "");
    await db
      .update(conversationsTable)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversationsTable.id, params.data.conversationId));
  } else {
    await db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, params.data.conversationId));
  }

  res.json({ userMessage, assistantMessage });
});

export default router;
