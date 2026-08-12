import type { NotificationPreferenceId, OrganizationId, UserId } from "@namera-ai/protocol";
import type { NotificationPreference } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { boolean, text, uniqueIndex } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { user } from "../auth/core/user.js";
import { organization } from "../auth/organization/organization.js";
import { notificationSchema } from "./common.js";

export const notificationPreference = notificationSchema.table(
  "notification_preferences",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<NotificationPreferenceId>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "restrict" }),
    organizationId: text("organization_id")
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    category: text("category").notNull().$type<NotificationPreference["category"]>(),
    channel: text("channel").notNull().$type<NotificationPreference["channel"]>(),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_preferences_global_uidx")
      .on(table.userId, table.category, table.channel)
      .where(sql`${table.organizationId} IS NULL`),
    uniqueIndex("notification_preferences_organization_uidx")
      .on(table.userId, table.organizationId, table.category, table.channel)
      .where(sql`${table.organizationId} IS NOT NULL`),
  ],
);
