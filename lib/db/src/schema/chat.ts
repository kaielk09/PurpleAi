import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const PURPLE_AI_MODEL =
  "nvidia/nemotron-3-ultra-550b-a55b:free" as const;

export const conversationsTable = pgTable(
  "purple_ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }).notNull().default("Nowa rozmowa"),
    model: varchar("model", { length: 120 })
      .notNull()
      .default(PURPLE_AI_MODEL),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("purple_ai_conversations_owner_updated_idx").on(
      table.ownerId,
      table.updatedAt,
    ),
  ],
);

export const messagesTable = pgTable(
  "purple_ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(),
    content: text("content").notNull(),
    model: varchar("model", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "purple_ai_messages_role_check",
      sql`${table.role} in ('user', 'assistant')`,
    ),
    index("purple_ai_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);
