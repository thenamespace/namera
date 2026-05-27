import type { AccountId, UserId } from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { index, text, uniqueIndex } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  generateUniqueId,
  timestamps,
  userRole,
} from "../common";
import { and, onlyIfNotDeleted, onlyUserId, PgPolicyBuilder } from "../policy";
import { authSchema } from "./common";
import { user } from "./user";

// Account Table
// Represents a user's account in Namera such as Email, Google, etc.
export const account = authSchema.table.withRLS(
  "account",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<AccountId>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    accessToken: text("access_token"),
    idToken: text("id_token"),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    scope: text("scope"),
    // Timestamps
    accessTokenExpiresAt: createTimestampField("access_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    refreshTokenExpiresAt: createTimestampField("refresh_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    lastUsedAt: createTimestampField("last_used_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    index("account_userId_idx")
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("account_providerId_accountId_idx")
      .on(table.providerId, table.accountId)
      .where(sql`${table.deletedAt} IS NULL`),
    // Users can only select their own accounts
    new PgPolicyBuilder()
      .name("account_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(and([onlyUserId(table.userId), onlyIfNotDeleted(table.deletedAt)]))
      .build(),
    // Users can only update their own accounts
    new PgPolicyBuilder()
      .name("account_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(and([onlyUserId(table.userId), onlyIfNotDeleted(table.deletedAt)]))
      .withCheck(
        and([onlyUserId(table.userId), onlyIfNotDeleted(table.deletedAt)]),
      )
      .build(),
    // Users can only insert their own accounts such as linking google etc.
    new PgPolicyBuilder()
      .name("account_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        and([onlyUserId(table.userId), onlyIfNotDeleted(table.deletedAt)]),
      )
      .build(),
    // Admins can access all accounts
    new PgPolicyBuilder()
      .name("account_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
