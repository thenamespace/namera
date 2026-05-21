import type {
  ActorType,
  EventSource,
  EventType,
  OrganizationEventId,
  OrganizationEventMetadata,
  OrganizationId,
  TargetType,
  UserId,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  generateUniqueId,
  userRole,
} from "@/schema/common";
import { onlyActorWithOrgAccess, PgPolicyBuilder } from "@/schema/policy";

import { organization, user } from "../auth";

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
    actorUserId: text("actor_user_id")
      .$type<UserId>()
      .references(() => user.id, { onDelete: "no action" }),
    // Target entity
    targetType: text("target_type").notNull().$type<TargetType>(),
    targetId: text("target_id").notNull(),
    // Tracking
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    traceId: text("trace_id"),
    source: text("source").notNull().$type<EventSource>(),
    metadata: jsonb("metadata")
      .notNull()
      .$type<OrganizationEventMetadata>()
      .default(sql`'{}'::jsonb`),
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
    index("organization_event_actor_user_created_at_idx")
      .on(table.actorUserId, table.createdAt.desc())
      .where(sql`${table.actorUserId} IS NOT NULL`),
    index("organization_event_trace_id_idx")
      .on(table.traceId)
      .where(sql`${table.traceId} IS NOT NULL`),
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
