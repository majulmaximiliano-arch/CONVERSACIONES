import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

// Augment the Express Request type globally
declare global {
  namespace Express {
    interface Request {
      sessionUser?: User;
    }
  }
}

/**
 * requireSession — resolves the current user from the signed session cookie
 * and attaches them to req.sessionUser. Responds 401 if no valid session.
 */
export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Use signed cookies — req.signedCookies returns false for tampered values
  const rawId = req.signedCookies?.userId;
  if (!rawId || rawId === false) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const userId = parseInt(rawId as string, 10);
  if (isNaN(userId)) {
    res.clearCookie("userId");
    res.status(401).json({ error: "Sesión inválida" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.clearCookie("userId");
    res.status(401).json({ error: "Usuario no encontrado" });
    return;
  }

  req.sessionUser = user;
  next();
}

/**
 * requireAdmin — must be used after requireSession.
 * Rejects non-admin users with 403.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.sessionUser?.role !== "admin") {
    res.status(403).json({ error: "Acceso denegado: se requiere rol administrador" });
    return;
  }
  next();
}
