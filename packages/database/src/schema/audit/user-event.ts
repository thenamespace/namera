import type { SessionId, UserEventId, UserId } from "@namera-ai/protocol";
import type { UserEvent, UserEventEncoded } from "@namera-ai/protocol/model";
import { index, jsonb, text, timestamp } from "drizzle-orm/pg-core";

import { generateUniqueId } from "#/schema/common";

import { user } from "../auth/core/user.js";
import { auditSchema } from "./common.js";

export const userEvent = auditSchema.table(
  "user_events",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<UserEventId>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "restrict" }),
    sessionId: text("session_id").$type<SessionId>(),
    event: text("event").notNull().$type<UserEvent["event"]>(),
    source: text("source").notNull().$type<UserEvent["source"]>(),
    data: jsonb("data").notNull().$type<UserEventEncoded["data"]>(),
    correlationId: text("correlation_id").notNull(),
    requestId: text("request_id"),
    traceId: text("trace_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("user_events_user_created_at_idx").on(table.userId, table.createdAt.desc()),
    index("user_events_user_event_created_at_idx").on(
      table.userId,
      table.event,
      table.createdAt.desc(),
    ),
    index("user_events_session_created_at_idx").on(table.sessionId, table.createdAt.desc()),
    index("user_events_correlation_id_idx").on(table.correlationId),
  ],
);
