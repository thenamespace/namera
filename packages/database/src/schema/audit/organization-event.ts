import type { ActorId, OrganizationEventId, OrganizationId } from "@namera-ai/protocol";
import type { OrganizationEvent, OrganizationEventEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, text, timestamp } from "drizzle-orm/pg-core";

import { generateUniqueId } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { organization } from "../auth/organization/organization.js";
import { auditSchema } from "./common.js";

export const organizationEvent = auditSchema.table(
  "organization_events",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<OrganizationEventId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorId: text("actor_id").$type<ActorId>(),
    event: text("event").notNull().$type<OrganizationEvent["event"]>(),
    source: text("source").notNull().$type<OrganizationEvent["source"]>(),
    resourceType: text("resource_type").$type<OrganizationEvent["resourceType"]>(),
    resourceId: text("resource_id").$type<OrganizationEvent["resourceId"]>(),
    data: jsonb("data").notNull().$type<OrganizationEventEncoded["data"]>(),
    correlationId: text("correlation_id").notNull(),
    requestId: text("request_id"),
    traceId: text("trace_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "organization_events_actor_organization_fk",
      columns: [table.actorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    check(
      "organization_events_resource_pair_check",
      sql`(${table.resourceType} IS NULL AND ${table.resourceId} IS NULL) OR (${table.resourceType} IS NOT NULL AND ${table.resourceId} IS NOT NULL)`,
    ),
    index("organization_events_organization_created_at_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
    index("organization_events_organization_event_created_at_idx").on(
      table.organizationId,
      table.event,
      table.createdAt.desc(),
    ),
    index("organization_events_organization_actor_created_at_idx").on(
      table.organizationId,
      table.actorId,
      table.createdAt.desc(),
    ),
    index("organization_events_resource_created_at_idx").on(
      table.organizationId,
      table.resourceType,
      table.resourceId,
      table.createdAt.desc(),
    ),
    index("organization_events_correlation_id_idx").on(table.correlationId),
  ],
);
