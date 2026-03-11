import type { UserId } from "@namera-ai/schema";
import { sql } from "drizzle-orm";
import { index, pgPolicy, text } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  timestamps,
  userRole,
} from "../common";
import { authSchema } from "./common";
import { user } from "./user";

export const account = authSchema.table.withRLS(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    accessToken: text("access_token"),
    accessTokenExpiresAt: createTimestampField("access_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    idToken: text("id_token"),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: createTimestampField("refresh_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    scope: text("scope"),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("account_userId_idx").on(table.userId),
    pgPolicy("account_user_select", {
      as: "permissive",
      to: userRole,
      for: "select",
      using: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("account_user_update", {
      as: "permissive",
      to: userRole,
      for: "update",
      using: sql`${table.userId} = auth_user_id()`,
      withCheck: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("account_user_delete", {
      as: "permissive",
      to: userRole,
      for: "delete",
      using: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("account_admin_access", {
      as: "permissive",
      to: adminRole,
      for: "all",
      using: sql`true`,
    }),
  ],
);
