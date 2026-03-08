import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/effect-schema";
import { index, text } from "drizzle-orm/pg-core";

import { createTimestampField, timestamps } from "../common";
import { authSchema } from "./common";
import { UserId, user } from "./user";

export const session = authSchema.table(
  "session",
  {
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    activeOrganizationId: text("active_organization_id"),
    expiresAt: createTimestampField("expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const SessionSchema = createSelectSchema(session, {
  userId: () => UserId,
});

export const SessionInsertSchema = createInsertSchema(session, {
  userId: () => UserId,
});

export const SessionUpdateSchema = createUpdateSchema(session, {
  userId: () => UserId,
});

export type Session = typeof SessionSchema.Type;
export type SessionInsert = typeof SessionInsertSchema.Type;
export type SessionUpdate = typeof SessionUpdateSchema.Type;
