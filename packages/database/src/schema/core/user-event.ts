import type { UserEventId, UserId } from "@namera-ai/schema";
import type { TargetType, UserEventMetadata } from "@namera-ai/schema/database";

import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  generateUniqueId,
  userRole,
} from "@/schema/common";
import { onlyUserId, PgPolicyBuilder } from "@/schema/policy";

import { user } from "../auth";

export const userEvent = pgTable.withRLS(
  "user_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<UserEventId>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "no action" }),
    eventType: text("event_type").notNull().$type<UserEventId>(),
    // Target entity
    targetType: text("target_type").notNull().$type<TargetType>(),
    targetId: text("target_id").notNull(),
    // Tracking
    traceId: text("trace_id").notNull(),
    source: text("source").notNull().$type<EventSource>(),
    metadata: jsonb("metadata").notNull().$type<UserEventMetadata>(),
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
    index("user_event_userId_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
    index("user_event_user_event_type_created_at_idx").on(
      table.userId,
      table.eventType,
      table.createdAt.desc(),
    ),
    index("user_event_target_created_at_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt.desc(),
    ),
    index("user_event_user_target_created_at_idx").on(
      table.userId,
      table.targetType,
      table.targetId,
      table.createdAt.desc(),
    ),
    index("user_event_trace_id_idx").on(table.traceId),
    index("user_event_user_source_created_at_idx").on(
      table.userId,
      table.source,
      table.createdAt.desc(),
    ),
    new PgPolicyBuilder()
      .name("user_event_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyUserId(table.userId))
      .build(),
    new PgPolicyBuilder()
      .name("user_event_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(onlyUserId(table.userId))
      .build(),
    new PgPolicyBuilder()
      .name("user_event_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
