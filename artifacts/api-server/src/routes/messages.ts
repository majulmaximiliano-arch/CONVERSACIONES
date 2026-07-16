import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  conversationsTable,
  messagesTable,
  dataFilesTable,
  fileColumnsTable,
  dataRowsTable,
  folderPermissionsTable,
  foldersTable,
} from "@workspace/db";
import { SendMessageBody, SendMessageParams } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireSession } from "../middleware/auth";
import { canAccessConversation } from "../lib/authorize";

const router: IRouter = Router();

router.post("/conversations/:conversationId/messages", requireSession, async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const user = req.sessionUser!;

  // Verify the user owns (or can access as admin) this conversation
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

  // Get conversation history (last 10 messages for context)
  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.conversationId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(11);

  const historyMessages = history.reverse().filter((m) => m.id !== userMessage.id);

  // Get folders the session user can access (from DB, not from request body)
  const userFolders = await db
    .select({
      folderId: folderPermissionsTable.folderId,
      folderName: foldersTable.name,
    })
    .from(folderPermissionsTable)
    .leftJoin(foldersTable, eq(foldersTable.id, folderPermissionsTable.folderId))
    .where(eq(folderPermissionsTable.userId, user.id));

  const accessibleFolderIds = userFolders.map((f) => f.folderId);

  // Admins can access all folders
  let folderNames: string[] = [];
  if (user.role === "admin") {
    const allFolders = await db.select({ name: foldersTable.name }).from(foldersTable);
    folderNames = allFolders.map((f) => f.name);
    const allFiles = await db.select({ folderId: dataFilesTable.folderId }).from(dataFilesTable);
    const allFolderIds = [...new Set(allFiles.map((f) => f.folderId))];
    accessibleFolderIds.push(...allFolderIds.filter((id) => !accessibleFolderIds.includes(id)));
  } else {
    folderNames = userFolders.map((f) => f.folderName).filter(Boolean) as string[];
  }

  const dataContext = await buildDataContext(parsed.data.content, accessibleFolderIds, folderNames);

  const systemPrompt = buildSystemPrompt(folderNames);
  const contextualQuestion = buildContextualQuestion(parsed.data.content, dataContext);

  let aiResponseText = "";
  let chartData: Record<string, unknown> | null = null;
  let kpis: Array<{ label: string; value: string; change?: string; trend?: string }> = [];
  let insights: string[] = [];
  const filesConsulted: string[] = dataContext.filesConsulted;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        ...historyMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: contextualQuestion },
      ],
    });

    const rawText = response.content[0]?.type === "text" ? response.content[0].text : "";

    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const structured = JSON.parse(jsonMatch[1]);
        aiResponseText = structured.answer ?? rawText;
        chartData = structured.chart ?? null;
        kpis = structured.kpis ?? [];
        insights = structured.insights ?? [];
      } catch {
        aiResponseText = rawText;
      }
    } else {
      aiResponseText = rawText;
    }
  } catch (err) {
    req.log.error({ err }, "Error calling Claude API");
    aiResponseText = "Lo siento, hubo un error al procesar tu consulta. Por favor intentá de nuevo.";
  }

  // Auto-generate title from first user message
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

  res.json({ userMessage, assistantMessage });
});

// ── Private helpers ───────────────────────────────────────────────────────────

async function buildDataContext(
  _question: string,
  accessibleFolderIds: number[],
  folderNames: string[],
): Promise<{ data: string; filesConsulted: string[] }> {
  if (accessibleFolderIds.length === 0) {
    return { data: "El usuario no tiene acceso a ninguna carpeta de datos.", filesConsulted: [] };
  }

  const files = await db
    .select()
    .from(dataFilesTable)
    .where(eq(dataFilesTable.status, "confirmed"));

  const accessibleFiles = files.filter((f) => accessibleFolderIds.includes(f.folderId));

  if (accessibleFiles.length === 0) {
    return {
      data: `El usuario tiene acceso a las carpetas: ${folderNames.join(", ")}. Sin embargo, no hay archivos confirmados aún.`,
      filesConsulted: [],
    };
  }

  const filesConsulted: string[] = [];
  const dataChunks: string[] = [];

  for (const file of accessibleFiles.slice(0, 5)) {
    const columns = await db.select().from(fileColumnsTable).where(eq(fileColumnsTable.fileId, file.id));
    const rows = await db.select().from(dataRowsTable).where(eq(dataRowsTable.fileId, file.id)).limit(50);

    if (rows.length === 0) continue;

    const fileLabel = `${file.originalFilename}${file.periodMonth ? ` (${file.periodMonth}/${file.periodYear})` : ""}`;
    filesConsulted.push(fileLabel);

    const colSummary = columns
      .map((c) => `${c.name} (${c.detectedType}${c.isMetric ? ", métrica" : ""}${c.isDimension ? ", dimensión" : ""})`)
      .join(", ");

    const metrics = columns.filter((c) => c.isMetric);
    const summaries: string[] = [];
    for (const metric of metrics.slice(0, 5)) {
      const values = rows
        .map((r) => Number((r.rowData as Record<string, unknown>)[metric.name]))
        .filter((n) => !isNaN(n));
      if (values.length > 0) {
        const total = values.reduce((a, b) => a + b, 0);
        const avg = total / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        summaries.push(`${metric.name}: total=${total.toFixed(2)}, promedio=${avg.toFixed(2)}, max=${max.toFixed(2)}, min=${min.toFixed(2)}`);
      }
    }

    const sampleRows = rows.slice(0, 10).map((r) => JSON.stringify(r.rowData)).join("\n");

    dataChunks.push(
      `### Archivo: ${fileLabel}\nColumnas: ${colSummary}\n${summaries.length > 0 ? `\nResumen métricas:\n${summaries.join("\n")}` : ""}\n\nMuestra de datos (${Math.min(10, rows.length)} de ${rows.length} filas):\n${sampleRows}`,
    );
  }

  return { data: dataChunks.join("\n\n---\n\n"), filesConsulted };
}

function buildSystemPrompt(folderNames: string[]): string {
  return `Sos un Gerente de Control de Gestión experto en concesionarios automotrices, trabajando dentro de CONVERSACIONES, una plataforma de inteligencia de negocio conversacional.

Tu rol es responder preguntas sobre el negocio de manera clara, precisa y accionable. No sos un chatbot genérico — sos un analista experto que conoce profundamente el negocio automotriz.

Carpetas de datos disponibles para este usuario: ${folderNames.join(", ") || "ninguna"}.

REGLAS:
1. Siempre explicá el razonamiento detrás de los números. No solo mostrés datos, interpretálos.
2. Detectá anomalías, tendencias y oportunidades automáticamente.
3. Cuando la pregunta lo permita, generá una visualización estructurada.
4. Respondé SIEMPRE en español argentino.
5. Si no tenés suficientes datos para responder con certeza, decilo claramente y sugerí qué archivos cargar.
6. Cuando calculés indicadores cruzados (Share, Rentabilidad, etc.), explicá el cálculo.

FORMATO DE RESPUESTA:
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

function buildContextualQuestion(
  question: string,
  dataContext: { data: string },
): string {
  const contextSection = dataContext.data
    ? `\n\n## Datos disponibles:\n${dataContext.data}`
    : "\n\n(No hay datos disponibles aún)";

  return `Pregunta del usuario: ${question}${contextSection}`;
}

export default router;
