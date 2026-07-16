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

  // Get conversation history (last 10 messages)
  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.conversationId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(11);

  const historyMessages = history.reverse().filter((m) => m.id !== userMessage.id);

  // Get folders accessible via hierarchical permissions (folder | tipo_negocio | marca)
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
    const parsed2 = parseAIResponse(rawText);
    aiResponseText = parsed2.answer || rawText;
    chartData = parsed2.chart || null;
    kpis = parsed2.kpis || [];
    insights = parsed2.insights || [];
  } catch (err) {
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

  // Update conversation title if first exchange
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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildDataContext(question: string, folderIds: number[], folderNames: string[]) {
  const filesConsulted: string[] = [];

  if (folderIds.length === 0) {
    return { data: "", filesConsulted };
  }

  const idList = sql.join(folderIds.map((id) => sql`${id}`), sql`, `);
  const files = await db
    .select()
    .from(dataFilesTable)
    .where(sql`${dataFilesTable.folderId} = ANY(ARRAY[${idList}]::int[]) AND ${dataFilesTable.status} = 'confirmed'`)
    .orderBy(desc(dataFilesTable.uploadedAt))
    .limit(5);

  if (files.length === 0) {
    return { data: "", filesConsulted };
  }

  const sections: string[] = [];
  const keywords = question.toLowerCase();

  for (const file of files) {
    const columns = await db.select().from(fileColumnsTable).where(eq(fileColumnsTable.fileId, file.id));
    const rows = await db
      .select()
      .from(dataRowsTable)
      .where(eq(dataRowsTable.fileId, file.id))
      .limit(50);

    if (rows.length === 0) continue;

    filesConsulted.push(file.originalFilename);
    const colNames = columns.map((c) => c.name).join(", ");
    const sampleData = rows
      .slice(0, 20)
      .map((r) => JSON.stringify(r.rowData))
      .join("\n");

    sections.push(
      `### Archivo: ${file.originalFilename}\nColumnas: ${colNames}\nDatos (muestra):\n${sampleData}`,
    );
  }

  return { data: sections.join("\n\n"), filesConsulted };
}

function parseAIResponse(text: string) {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    return { answer: text };
  } catch {
    return { answer: text };
  }
}

function buildSystemPrompt(folderNames: string[]): string {
  return `Sos un analista de inteligencia de negocios especializado en concesionarias automotrices.
Respondés preguntas sobre datos de ventas, postventa, finanzas y operaciones.

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

function buildContextualQuestion(question: string, dataContext: { data: string }): string {
  const contextSection = dataContext.data
    ? `\n\n## Datos disponibles:\n${dataContext.data}`
    : "\n\n(No hay datos disponibles aún)";

  return `Pregunta del usuario: ${question}${contextSection}`;
}

export default router;
