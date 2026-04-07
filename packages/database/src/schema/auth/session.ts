import type { SessionId, UserId } from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { index, pgPolicy, text } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  generateUniqueId,
  timestamps,
  userRole,
} from "../common";
import { authSchema } from "./common";
import { user } from "./user";

export const session = authSchema.table.withRLS(
  "session",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SessionId>(),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    expiresAt: createTimestampField("expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    index("session_userId_idx").on(table.userId),
    pgPolicy("session_user_select", {
      as: "permissive",
      to: userRole,
      for: "select",
      using: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("session_user_update", {
      as: "permissive",
      to: userRole,
      for: "update",
      using: sql`${table.userId} = auth_user_id()`,
      withCheck: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("session_user_delete", {
      as: "permissive",
      to: userRole,
      for: "delete",
      using: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("session_admin_access", {
      as: "permissive",
      to: adminRole,
      for: "all",
      using: sql`true`,
    }),
  ],
);
