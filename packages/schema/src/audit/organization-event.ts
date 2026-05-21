import { Schema } from "effect";

import { OrganizationEventId, OrganizationId, UserId } from "@/common";
import { createInsertSchema } from "@/helpers";

export const EventType = Schema.String;
export const ActorType = Schema.Literals([
  "user",
  "api_key",
  "integration",
  "service",
  "system",
]);
export const TargetType = Schema.String;
export const EventSource = Schema.Literals([
  "dashboard",
  "api",
  "sdk",
  "worker",
  "webhook",
  "chain_indexer",
  "system",
]);
export const OrganizationEventMetadata = Schema.Json;

export const OrganizationEvent = Schema.Struct({
  id: OrganizationEventId,
  organizationId: OrganizationId,
  eventType: EventType,
  // Actor who caused the event
  actorType: ActorType,
  actorId: Schema.String,
  actorUserId: Schema.NullOr(UserId),
  // Target entity
  targetType: TargetType,
  targetId: Schema.String,
  // Tracking
  ipAddress: Schema.NullOr(Schema.String),
  userAgent: Schema.NullOr(Schema.String),
  traceId: Schema.NullOr(Schema.String),
  source: EventSource,
  metadata: Schema.Json,
  createdAt: Schema.Date,
});

export const OrganizationEventInsert = createInsertSchema(
  OrganizationEvent,
  "organizationId",
  "eventType",
  "actorType",
  "actorId",
  "targetId",
  "targetType",
  "source",
);

export type EventType = typeof EventType.Type;
export type ActorType = typeof ActorType.Type;
export type TargetType = typeof TargetType.Type;
export type EventSource = typeof EventSource.Type;
export type OrganizationEventMetadata = typeof OrganizationEventMetadata.Type;

export type OrganizationEvent = typeof OrganizationEvent.Type;
export type OrganizationEventInsert = typeof OrganizationEventInsert.Type;
