import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  ListUsersResponse,
  CreateUserBody,
  CreateUserResponse,
  GetUserParams,
  GetUserResponse,
  UpdateUserParams,
  UpdateUserBody,
  UpdateUserResponse,
  DeleteUserParams,
  GetSessionResponse,
  SetSessionBody,
  SetSessionResponse,
} from "@workspace/api-zod";
import { requireSession, requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

// ── Session (public) ──────────────────────────────────────────────────────────

router.get("/session", async (req, res): Promise<void> => {
  const rawId = req.signedCookies?.userId;
  const userId = rawId ? parseInt(rawId, 10) : NaN;

  if (!rawId || isNaN(userId)) {
    res.json(GetSessionResponse.parse({ userId: null, user: null }));
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  res.json(GetSessionResponse.parse({ userId: user?.id ?? null, user: user ?? null }));
});

router.post("/session", async (req, res): Promise<void> => {
  const parsed = SetSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  res.cookie("userId", String(user.id), {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json(SetSessionResponse.parse({ userId: user.id, user }));
});

router.delete("/session", async (_req, res): Promise<void> => {
  res.clearCookie("userId");
  res.sendStatus(204);
});

// ── Users — admin only ────────────────────────────────────────────────────────

// GET /users is intentionally public: the MVP user-selection screen needs
// it without a session. Only name, email, role are exposed — no secrets.
router.get("/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(ListUsersResponse.parse(users));
});

router.post("/users", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.insert(usersTable).values(parsed.data).returning();
  res.status(201).json(CreateUserResponse.parse(user));
});

router.get("/users/:userId", requireSession, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Analysts can only view their own profile
  const actingUser = req.sessionUser!;
  if (actingUser.role !== "admin" && actingUser.id !== params.data.userId) {
    res.status(403).json({ error: "Acceso denegado" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  res.json(GetUserResponse.parse(user));
});

router.patch("/users/:userId", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, params.data.userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  res.json(UpdateUserResponse.parse(user));
});

router.delete("/users/:userId", requireSession, requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Prevent self-deletion
  if (req.sessionUser!.id === params.data.userId) {
    res.status(400).json({ error: "No podés eliminar tu propia cuenta" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, params.data.userId));
  res.sendStatus(204);
});

export default router;
