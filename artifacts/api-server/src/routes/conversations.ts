import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import {
  ListConversationsResponse,
  CreateConversationBody,
  CreateConversationResponse,
  GetConversationParams,
  GetConversationResponse,
  DeleteConversationParams,
} from "@workspace/api-zod";
import { requireSession } from "../middleware/auth";
import { canAccessConversation } from "../lib/authorize";

const router: IRouter = Router();

// All conversation routes require a valid session.
// Users can only see their own conversations; admins see all.

router.get("/conversations", requireSession, async (req, res): Promise<void> => {
  const user = req.sessionUser!;

  const conversations = await db
    .select({
      id: conversationsTable.id,
      userId: conversationsTable.userId,
      title: conversationsTable.title,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
      messageCount: sql<number>`count(${messagesTable.id})::int`,
    })
    .from(conversationsTable)
    .leftJoin(messagesTable, eq(messagesTable.conversationId, conversationsTable.id))
    // Admins can query all; analysts only see their own
    .where(user.role === "admin" ? sql`TRUE` : eq(conversationsTable.userId, user.id))
    .groupBy(conversationsTable.id)
    .orderBy(desc(conversationsTable.updatedAt));

  res.json(ListConversationsResponse.parse(conversations));
});

router.post("/conversations", requireSession, async (req, res): Promise<void> => {
  const user = req.sessionUser!;

  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Always create conversation for the session user, ignoring body userId
  const [conversation] = await db
    .insert(conversationsTable)
    .values({ userId: user.id, title: parsed.data.title })
    .returning();

  res.status(201).json(CreateConversationResponse.parse({ ...conversation, messageCount: 0 }));
});

router.get("/conversations/:conversationId", requireSession, async (req, res): Promise<void> => {
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conversation = await canAccessConversation(req.sessionUser!, params.data.conversationId);
  if (!conversation) {
    res.status(404).json({ error: "Conversación no encontrada" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.conversationId))
    .orderBy(messagesTable.createdAt);

  res.json(GetConversationResponse.parse({ ...conversation, messages }));
});

router.delete("/conversations/:conversationId", requireSession, async (req, res): Promise<void> => {
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conversation = await canAccessConversation(req.sessionUser!, params.data.conversationId);
  if (!conversation) {
    res.status(404).json({ error: "Conversación no encontrada" });
    return;
  }

  await db.delete(conversationsTable).where(eq(conversationsTable.id, params.data.conversationId));
  res.sendStatus(204);
});

export default router;
