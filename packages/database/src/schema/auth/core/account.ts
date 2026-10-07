import type { AccountId, UserId } from "@namera-ai/protocol";
import { sql } from "drizzle-orm";
import { text, index, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";
import { user } from "./user.js";

export const account = authSchema.table(
  "account",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<AccountId>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    providerEmail: text("provider_email"),
    accessToken: text("access_token"),
    idToken: text("id_token"),
    refreshToken: text("refresh_token"),
    password: text("password"),
    scope: text("scope"),
    accessTokenExpiresAt: createTimestampField("access_token_expires_at"),
    refreshTokenExpiresAt: createTimestampField("refresh_token_expires_at"),
    lastUsedAt: createTimestampField("last_used_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("account_provider_account_uidx").on(table.providerId, table.accountId),
    index("account_user_idx").on(table.userId),
    index("account_provider_user_idx").on(table.providerId, table.userId),
    uniqueIndex("account_google_user_uidx")
      .on(table.userId)
      .where(sql`${table.providerId} = 'google'`),
  ],
);
