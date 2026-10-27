import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const usersTable = pgTable(
  "purple_ai_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 32 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("purple_ai_users_email_lower_idx").on(
      sql`lower(${table.email})`,
    ),
    uniqueIndex("purple_ai_users_username_lower_idx").on(
      sql`lower(${table.username})`,
    ),
  ],
);

export const sessionsTable = pgTable(
  "purple_ai_sessions",
  {
    idHash: varchar("id_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    csrfHash: varchar("csrf_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("purple_ai_sessions_user_id_idx").on(table.userId)],
);

export const passwordResetTokensTable = pgTable(
  "purple_ai_password_reset_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("purple_ai_password_reset_user_id_idx").on(table.userId),
    index("purple_ai_password_reset_expires_at_idx").on(table.expiresAt),
  ],
);

export const userPreferencesTable = pgTable("purple_ai_user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  enterToSend: boolean("enter_to_send").notNull().default(true),
  showTimestamps: boolean("show_timestamps").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
