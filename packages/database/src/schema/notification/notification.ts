import type { ActorId, NotificationId, OrganizationId } from "@namera-ai/protocol";
import type { Notification, NotificationEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { organization } from "../auth/organization/organization.js";
import { notificationSchema } from "./common.js";

export const notification = notificationSchema.table(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<NotificationId>(),
    organizationId: text("organization_id")
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorId: text("actor_id").$type<ActorId>(),
    type: text("type").notNull().$type<Notification["type"]>(),
    data: jsonb("data").notNull().$type<NotificationEncoded["data"]>(),
    resourceType: text("resource_type").notNull().$type<Notification["resourceType"]>(),
    resourceId: text("resource_id").notNull().$type<Notification["resourceId"]>(),
    idempotencyKey: text("idempotency_key").notNull(),
    correlationId: text("correlation_id").notNull(),
    expiresAt: createTimestampField("expires_at"),
    createdAt: createTimestampField("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notifications_idempotency_key_uidx").on(table.idempotencyKey),
    foreignKey({
      name: "notifications_actor_organization_fk",
      columns: [table.actorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    check(
      "notifications_actor_organization_check",
      sql`${table.actorId} IS NULL OR ${table.organizationId} IS NOT NULL`,
    ),
    index("notifications_organization_created_at_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
    index("notifications_organization_type_created_at_idx").on(
      table.organizationId,
      table.type,
      table.createdAt.desc(),
    ),
    index("notifications_resource_created_at_idx").on(
      table.resourceType,
      table.resourceId,
      table.createdAt.desc(),
    ),
    index("notifications_expires_at_idx")
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} IS NOT NULL`),
  ],
);
