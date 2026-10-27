import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import {
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
} from "@workspace/api-zod";
import {
  db,
  passwordResetTokensTable,
  sessionsTable,
  userPreferencesTable,
  usersTable,
} from "@workspace/db";
import {
  clearSessionCookies,
  createOpaqueToken,
  getAuthContext,
  getOrIssueCsrfToken,
  requireAuth,
  requireCsrf,
  requireSameOrigin,
  setCsrfCookie,
  setSessionCookies,
  sha256,
} from "../middlewares/security";
import { hashPassword, verifyPassword } from "../lib/passwords";

const router: IRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Zbyt wiele prób. Spróbuj ponownie za kilka minut." },
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Osiągnięto limit rejestracji. Spróbuj później." },
});

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Zbyt wiele próśb o reset hasła. Spróbuj później." },
});

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function publicUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

router.get("/auth/csrf", async (req, res, next): Promise<void> => {
  try {
    const token = await getOrIssueCsrfToken(req, res);
    res.json({ token });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/auth/register",
  registrationLimiter,
  requireSameOrigin,
  requireCsrf,
  async (req, res, next): Promise<void> => {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Sprawdź poprawność wprowadzonych danych." });
      return;
    }

    const username = parsed.data.username.trim();
    const email = parsed.data.email.trim().toLowerCase();
    if (parsed.data.password !== parsed.data.confirmPassword) {
      res.status(400).json({ error: "Hasła nie są identyczne." });
      return;
    }

    try {
      const [existingUser] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(
          or(
            sql`lower(${usersTable.email}) = ${email}`,
            sql`lower(${usersTable.username}) = ${username.toLowerCase()}`,
          ),
        )
        .limit(1);
      if (existingUser) {
        res.status(409).json({
          error: "Ten adres e-mail lub nazwa użytkownika są już zajęte.",
        });
        return;
      }

      const passwordHash = await hashPassword(parsed.data.password);
      const user = await db.transaction(async (tx) => {
        const [createdUser] = await tx
          .insert(usersTable)
          .values({ username, email, passwordHash })
          .returning();
        if (!createdUser) throw new Error("User insert returned no row.");
        await tx.insert(userPreferencesTable).values({ userId: createdUser.id });
        return createdUser;
      });

      const previousSession = req.cookies?.purple_ai_session;
      if (typeof previousSession === "string") {
        await db
          .delete(sessionsTable)
          .where(eq(sessionsTable.idHash, sha256(previousSession)));
      }
      const sessionToken = createOpaqueToken();
      const csrfToken = createOpaqueToken();
      await db.insert(sessionsTable).values({
        idHash: sha256(sessionToken),
        userId: user.id,
        csrfHash: sha256(csrfToken),
        expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      });
      setSessionCookies(res, sessionToken, csrfToken);

      res.status(201).json({ user: publicUser(user), csrfToken });
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
      if (code === "23505") {
        res.status(409).json({
          error: "Ten adres e-mail lub nazwa użytkownika są już zajęte.",
        });
        return;
      }
      next(error);
    }
  },
);

router.post(
  "/auth/login",
  authLimiter,
  requireSameOrigin,
  requireCsrf,
  async (req, res, next): Promise<void> => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Podaj poprawny adres e-mail i hasło." });
      return;
    }

    try {
      const email = parsed.data.email.trim().toLowerCase();
      const [user] = await db
        .select()
        .from(usersTable)
        .where(sql`lower(${usersTable.email}) = ${email}`)
        .limit(1);
      if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
        res.status(401).json({ error: "Nieprawidłowy e-mail lub hasło." });
        return;
      }

      const previousSession = req.cookies?.purple_ai_session;
      if (typeof previousSession === "string") {
        await db
          .delete(sessionsTable)
          .where(eq(sessionsTable.idHash, sha256(previousSession)));
      }
      const sessionToken = createOpaqueToken();
      const csrfToken = createOpaqueToken();
      await db.insert(sessionsTable).values({
        idHash: sha256(sessionToken),
        userId: user.id,
        csrfHash: sha256(csrfToken),
        expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      });
      setSessionCookies(res, sessionToken, csrfToken);

      res.json({ user: publicUser(user), csrfToken });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/auth/session", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const auth = getAuthContext(req);
    let csrfToken = req.cookies?.purple_ai_csrf;
    if (
      typeof csrfToken !== "string" ||
      sha256(csrfToken) !== auth.csrfHash
    ) {
      csrfToken = createOpaqueToken();
      await db
        .update(sessionsTable)
        .set({ csrfHash: sha256(csrfToken) })
        .where(eq(sessionsTable.idHash, auth.sessionIdHash));
      setCsrfCookie(res, csrfToken);
    }
    res.json({ user: auth.user, csrfToken });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/auth/logout",
  requireAuth,
  requireSameOrigin,
  requireCsrf,
  async (req, res, next): Promise<void> => {
    try {
      const auth = getAuthContext(req);
      await db
        .delete(sessionsTable)
        .where(eq(sessionsTable.idHash, auth.sessionIdHash));
      clearSessionCookies(res);
      res.json({ status: "signed_out" });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/auth/forgot-password",
  recoveryLimiter,
  requireSameOrigin,
  requireCsrf,
  async (_req, res): Promise<void> => {
    // Recovery is deliberately unavailable until a transactional email provider
    // is connected. Never report a message as sent when no provider delivered it.
    res.status(503).json({
      error:
        "Wysyłanie e-maili odzyskiwania hasła nie jest skonfigurowane. Wiadomość nie została wysłana.",
    });
  },
);

router.post(
  "/auth/reset-password",
  recoveryLimiter,
  requireSameOrigin,
  requireCsrf,
  async (req, res, next): Promise<void> => {
    const parsed = ResetPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Link resetujący lub hasło są nieprawidłowe." });
      return;
    }
    if (parsed.data.password !== parsed.data.confirmPassword) {
      res.status(400).json({ error: "Hasła nie są identyczne." });
      return;
    }

    try {
      const tokenHash = sha256(parsed.data.token);
      const [resetToken] = await db
        .select()
        .from(passwordResetTokensTable)
        .where(
          and(
            eq(passwordResetTokensTable.tokenHash, tokenHash),
            gt(passwordResetTokensTable.expiresAt, new Date()),
            isNull(passwordResetTokensTable.usedAt),
          ),
        )
        .limit(1);
      if (!resetToken) {
        res.status(410).json({
          error: "Link resetujący jest nieprawidłowy lub wygasł.",
        });
        return;
      }

      const passwordHash = await hashPassword(parsed.data.password);
      await db.transaction(async (tx) => {
        await tx
          .update(usersTable)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(usersTable.id, resetToken.userId));
        await tx
          .update(passwordResetTokensTable)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokensTable.tokenHash, tokenHash));
        await tx
          .delete(sessionsTable)
          .where(eq(sessionsTable.userId, resetToken.userId));
        await tx
          .delete(passwordResetTokensTable)
          .where(eq(passwordResetTokensTable.userId, resetToken.userId));
      });
      clearSessionCookies(res);
      res.json({ status: "password_changed" });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
