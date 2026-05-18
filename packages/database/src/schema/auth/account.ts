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
import { onlyUserId, PgPolicyBuilder } from "../policy";
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
    ...timestamps,
  },
  (table) => [
    index("account_userId_idx").on(table.userId),
    uniqueIndex("account_providerId_accountId_idx").on(
      table.providerId,
      table.accountId,
    ),
    // Users can only select their own accounts
    new PgPolicyBuilder()
      .name("account_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyUserId(table.userId))
      .build(),
    // Users can only update their own accounts
    new PgPolicyBuilder()
      .name("account_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(onlyUserId(table.userId))
      .withCheck(onlyUserId(table.userId))
      .build(),
    // Users can only insert their own accounts such as linking google etc.
    new PgPolicyBuilder()
      .name("account_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(onlyUserId(table.userId))
      .build(),
    // Users can only delete their own accounts, such as unlinking google etc.
    new PgPolicyBuilder()
      .name("account_delete")
      .as("permissive")
      .to(userRole)
      .forOperation("delete")
      .using(onlyUserId(table.userId))
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
