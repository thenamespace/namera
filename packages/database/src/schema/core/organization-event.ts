import type { OrganizationEventId, OrganizationId } from "@namera-ai/schema";
import type {
  ActorType,
  EventType,
  OrganizationEventMetadata,
  TargetType,
} from "@namera-ai/schema/database";

import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  generateUniqueId,
  userRole,
} from "@/schema/common";
import { onlyActorWithOrgAccess, PgPolicyBuilder } from "@/schema/policy";

import { organization } from "../auth";

export const organizationEvent = pgTable.withRLS(
  "organization_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<OrganizationEventId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "no action" }),
    eventType: text("event_type").notNull().$type<EventType>(),
    // Actor who caused the event
    actorType: text("actor_type").notNull().$type<ActorType>(),
    actorId: text("actor_id").notNull(),
    // Target entity
    targetType: text("target_type").notNull().$type<TargetType>(),
    targetId: text("target_id").notNull(),
    // Tracking
    traceId: text("trace_id").notNull(),
    source: text("source").notNull().$type<EventSource>(),
    metadata: jsonb("metadata").notNull().$type<OrganizationEventMetadata>(),
    // Timestamps
    createdAt: createTimestampField("created_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Indexes
    index("organization_event_organization_created_at_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
    index("organization_event_organization_event_type_created_at_idx").on(
      table.organizationId,
      table.eventType,
      table.createdAt.desc(),
    ),
    index("organization_event_target_created_at_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt.desc(),
    ),
    index("organization_event_organization_target_created_at_idx").on(
      table.organizationId,
      table.targetType,
      table.targetId,
      table.createdAt.desc(),
    ),
    index("organization_event_actor_created_at_idx").on(
      table.actorType,
      table.actorId,
      table.createdAt.desc(),
    ),
    index("organization_event_trace_id_idx").on(table.traceId),
    index("organization_event_organization_actor_created_at_idx").on(
      table.organizationId,
      table.actorType,
      table.actorId,
      table.createdAt.desc(),
    ),
    index("organization_event_organization_source_created_at_idx").on(
      table.organizationId,
      table.source,
      table.createdAt.desc(),
    ),
    new PgPolicyBuilder()
      .name("organization_event_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyActorWithOrgAccess(table.organizationId))
      .build(),
    new PgPolicyBuilder()
      .name("organization_event_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(onlyActorWithOrgAccess(table.organizationId))
      .build(),
    new PgPolicyBuilder()
      .name("organization_event_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
