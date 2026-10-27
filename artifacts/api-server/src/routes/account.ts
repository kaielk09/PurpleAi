import { and, eq, ne, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import {
  ChangePasswordBody,
  DeleteAccountBody,
  GetAccountSettingsResponse,
  UpdateAccountSettingsBody,
  UpdateUsernameBody,
  UpdateUsernameResponse,
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
  getAuthContext,
  requireAuth,
  requireCsrf,
  requireSameOrigin,
} from "../middlewares/security";
import { hashPassword, verifyPassword } from "../lib/passwords";

const router: IRouter = Router();
const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Zbyt wiele prób. Spróbuj ponownie później." },
});

router.get(
  "/account/settings",
  requireAuth,
  async (req, res, next): Promise<void> => {
    try {
      const auth = getAuthContext(req);
      await db
        .insert(userPreferencesTable)
        .values({ userId: auth.userId })
        .onConflictDoNothing();

      const [preferences] = await db
        .select({
          enterToSend: userPreferencesTable.enterToSend,
          showTimestamps: userPreferencesTable.showTimestamps,
        })
        .from(userPreferencesTable)
        .where(eq(userPreferencesTable.userId, auth.userId))
        .limit(1);
      const data = GetAccountSettingsResponse.parse({
        user: auth.user,
        preferences: preferences ?? {
          enterToSend: true,
          showTimestamps: true,
        },
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/account/settings",
  requireAuth,
  requireSameOrigin,
  requireCsrf,
  async (req, res, next): Promise<void> => {
    const parsed = UpdateAccountSettingsBody.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
      res.status(400).json({ error: "Wybierz co najmniej jedną preferencję." });
      return;
    }

    try {
      const auth = getAuthContext(req);
      await db
        .insert(userPreferencesTable)
        .values({ userId: auth.userId, ...parsed.data })
        .onConflictDoUpdate({
          target: userPreferencesTable.userId,
          set: { ...parsed.data, updatedAt: new Date() },
        });

      const [preferences] = await db
        .select({
          enterToSend: userPreferencesTable.enterToSend,
          showTimestamps: userPreferencesTable.showTimestamps,
        })
        .from(userPreferencesTable)
        .where(eq(userPreferencesTable.userId, auth.userId))
        .limit(1);
      res.json(
        GetAccountSettingsResponse.parse({
          user: auth.user,
          preferences,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/account/username",
  requireAuth,
  requireSameOrigin,
  requireCsrf,
  async (req, res, next): Promise<void> => {
    const parsed = UpdateUsernameBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Nazwa musi mieć od 3 do 32 znaków." });
      return;
    }

    try {
      const auth = getAuthContext(req);
      const username = parsed.data.username.trim();
      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(
          and(
            sql`lower(${usersTable.username}) = ${username.toLowerCase()}`,
            ne(usersTable.id, auth.userId),
          ),
        )
        .limit(1);
      if (existing) {
        res.status(409).json({ error: "Ta nazwa użytkownika jest już zajęta." });
        return;
      }

      const [updated] = await db
        .update(usersTable)
        .set({ username, updatedAt: new Date() })
        .where(eq(usersTable.id, auth.userId))
        .returning({
          id: usersTable.id,
          username: usersTable.username,
          email: usersTable.email,
          createdAt: usersTable.createdAt,
        });
      if (!updated) {
        res.status(404).json({ error: "Nie znaleziono konta." });
        return;
      }
      res.json(UpdateUsernameResponse.parse(updated));
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
      if (code === "23505") {
        res.status(409).json({ error: "Ta nazwa użytkownika jest już zajęta." });
        return;
      }
      next(error);
    }
  },
);

router.patch(
  "/account/password",
  requireAuth,
  requireSameOrigin,
  requireCsrf,
  sensitiveActionLimiter,
  async (req, res, next): Promise<void> => {
    const parsed = ChangePasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Sprawdź wprowadzone hasła." });
      return;
    }
    if (parsed.data.newPassword !== parsed.data.confirmPassword) {
      res.status(400).json({ error: "Nowe hasła nie są identyczne." });
      return;
    }

    try {
      const auth = getAuthContext(req);
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, auth.userId))
        .limit(1);
      if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
        res.status(401).json({ error: "Aktualne hasło jest nieprawidłowe." });
        return;
      }

      const passwordHash = await hashPassword(parsed.data.newPassword);
      await db.transaction(async (tx) => {
        await tx
          .update(usersTable)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(usersTable.id, auth.userId));
        await tx
          .delete(sessionsTable)
          .where(
            and(
              eq(sessionsTable.userId, auth.userId),
              ne(sessionsTable.idHash, auth.sessionIdHash),
            ),
          );
        await tx
          .delete(passwordResetTokensTable)
          .where(eq(passwordResetTokensTable.userId, auth.userId));
      });
      res.json({ status: "password_changed" });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/account/account",
  requireAuth,
  requireSameOrigin,
  requireCsrf,
  sensitiveActionLimiter,
  async (req, res, next): Promise<void> => {
    const parsed = DeleteAccountBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Podaj hasło, aby usunąć konto." });
      return;
    }

    try {
      const auth = getAuthContext(req);
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, auth.userId))
        .limit(1);
      if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
        res.status(401).json({ error: "Hasło jest nieprawidłowe." });
        return;
      }

      await db.delete(usersTable).where(eq(usersTable.id, auth.userId));
      clearSessionCookies(res);
      res.json({ status: "account_deleted" });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
