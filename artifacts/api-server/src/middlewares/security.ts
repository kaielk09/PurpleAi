import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import {
  db,
  sessionsTable,
  usersTable,
} from "@workspace/db";

export const SESSION_COOKIE = "purple_ai_session";
export const CSRF_COOKIE = "purple_ai_csrf";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production";

export type PublicUser = Pick<
  typeof usersTable.$inferSelect,
  "id" | "username" | "email" | "createdAt"
>;

export type AuthContext = {
  userId: string;
  sessionIdHash: string;
  csrfHash: string;
  user: PublicUser;
};

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE, token, cookieOptions(SESSION_LIFETIME_MS));
}

export function setSessionCookies(
  res: Response,
  sessionToken: string,
  csrfToken: string,
): void {
  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LIFETIME_MS,
  });
  setCsrfCookie(res, csrfToken);
}

export function clearSessionCookies(res: Response): void {
  const common = {
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
  };
  res.clearCookie(SESSION_COOKIE, { ...common, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...common, httpOnly: false });
}

export async function issueSession(
  userId: string,
  req: Request,
  res: Response,
): Promise<string> {
  const previousToken = req.cookies?.[SESSION_COOKIE];
  if (typeof previousToken === "string") {
    await db.delete(sessionsTable).where(eq(sessionsTable.idHash, sha256(previousToken)));
  }

  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await db.insert(sessionsTable).values({
    idHash: sha256(sessionToken),
    userId,
    csrfHash: sha256(csrfToken),
    expiresAt,
  });

  setSessionCookies(res, sessionToken, csrfToken);
  return csrfToken;
}

export async function getOrIssueCsrfToken(
  req: Request,
  res: Response,
): Promise<string> {
  const sessionToken = req.cookies?.[SESSION_COOKIE];
  if (typeof sessionToken === "string") {
    const sessionIdHash = sha256(sessionToken);
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.idHash, sessionIdHash),
          gt(sessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (session) {
      const previousCsrf = req.cookies?.[CSRF_COOKIE];
      if (
        typeof previousCsrf === "string" &&
        secureEqual(sha256(previousCsrf), session.csrfHash)
      ) {
        setCsrfCookie(res, previousCsrf);
        return previousCsrf;
      }

      const csrfToken = createOpaqueToken();
      await db
        .update(sessionsTable)
        .set({ csrfHash: sha256(csrfToken) })
        .where(eq(sessionsTable.idHash, sessionIdHash));
      setCsrfCookie(res, csrfToken);
      return csrfToken;
    }
  }

  const csrfToken = req.cookies?.[CSRF_COOKIE];
  if (typeof csrfToken === "string" && csrfToken.length >= 32) {
    setCsrfCookie(res, csrfToken);
    return csrfToken;
  }

  const newToken = createOpaqueToken();
  setCsrfCookie(res, newToken);
  return newToken;
}

export function requireSameOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const origin = req.get("origin");
  const host =
    req.get("x-forwarded-host")?.split(",")[0]?.trim() ?? req.get("host");
  const protocol =
    req.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? req.protocol;

  if (!origin || !host) {
    res.status(403).json({ error: "Request origin could not be verified." });
    return;
  }

  try {
    const parsedOrigin = new URL(origin);
    if (
      parsedOrigin.host.toLowerCase() !== host.toLowerCase() ||
      parsedOrigin.protocol !== `${protocol}:`
    ) {
      res.status(403).json({ error: "Cross-origin requests are not allowed." });
      return;
    }
  } catch {
    res.status(403).json({ error: "Request origin could not be verified." });
    return;
  }

  if (req.get("sec-fetch-site") === "cross-site") {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }

  next();
}

export function requireCsrf(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get("x-csrf-token");
  if (
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    !secureEqual(cookieToken, headerToken)
  ) {
    res.status(403).json({ error: "Security token is missing or invalid." });
    return;
  }

  if (
    req.authContext &&
    !secureEqual(sha256(cookieToken), req.authContext.csrfHash)
  ) {
    res.status(403).json({ error: "Security token is missing or invalid." });
    return;
  }

  next();
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionToken = req.cookies?.[SESSION_COOKIE];
    if (typeof sessionToken !== "string" || sessionToken.length < 32) {
      res.status(401).json({ error: "Please sign in to continue." });
      return;
    }

    const sessionIdHash = sha256(sessionToken);
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.idHash, sessionIdHash),
          gt(sessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!session) {
      clearSessionCookies(res);
      res.status(401).json({ error: "Please sign in to continue." });
      return;
    }

    const [user] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);
    if (!user) {
      clearSessionCookies(res);
      res.status(401).json({ error: "Please sign in to continue." });
      return;
    }

    req.authContext = {
      userId: user.id,
      sessionIdHash,
      csrfHash: session.csrfHash,
      user,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthContext(req: Request): AuthContext {
  if (!req.authContext) {
    throw new Error("Authenticated route is missing its auth context.");
  }
  return req.authContext;
}
