import type {
  NotificationPreferences,
  UserId,
  UserPreferenceId,
  UserPreferenceMetadata,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import {
  adminRole,
  generateUniqueId,
  timestamps,
  userRole,
} from "@/schema/common";
import {
  and,
  onlyIfNotDeleted,
  onlyUserId,
  PgPolicyBuilder,
} from "@/schema/policy";

import { user } from "../auth";

export const userPreference = pgTable.withRLS(
  "user_preference",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<UserPreferenceId>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    notificationPreferences: jsonb("notification_preferences")
      .notNull()
      .$type<NotificationPreferences>(),
    metadata: jsonb("metadata").notNull().$type<UserPreferenceMetadata>(),
    ...timestamps,
  },
  (table) => [
    // Indexes
    uniqueIndex("user_preference_user_id_uidx")
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),
    new PgPolicyBuilder()
      .name("user_preference_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(and([onlyUserId(table.userId), onlyIfNotDeleted(table.deletedAt)]))
      .build(),
    new PgPolicyBuilder()
      .name("user_preference_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(and([onlyUserId(table.userId), onlyIfNotDeleted(table.deletedAt)]))
      .withCheck(
        and([onlyUserId(table.userId), onlyIfNotDeleted(table.deletedAt)]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("user_preference_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        and([onlyUserId(table.userId), onlyIfNotDeleted(table.deletedAt)]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("user_preference_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
