import { Schema } from "effect";

import { OrganizationEventId, OrganizationId } from "@/common";
import { createInsertSchema } from "@/database/helpers";

export const EventType = Schema.String;
export const ActorType = Schema.Literals(["user"]);
export const TargetType = Schema.String;
export const EventSource = Schema.Literals(["dashboard"]);
export const OrganizationEventMetadata = Schema.Struct({
  ipAddress: Schema.optionalKey(Schema.String),
  userAgent: Schema.optionalKey(Schema.String),
});

export const OrganizationEvent = Schema.Struct({
  id: OrganizationEventId,
  organizationId: OrganizationId,
  // What happened?
  eventType: EventType,
  // Actor who caused the event, can be api key, org member etc.
  actorType: ActorType,
  actorId: Schema.String,
  // Target entity
  targetType: TargetType,
  targetId: Schema.String,
  // Tracking
  traceId: Schema.String,
  source: EventSource,
  metadata: OrganizationEventMetadata,
  // Timestamps
  createdAt: Schema.Date,
});

export const OrganizationEventInsert = createInsertSchema(
  OrganizationEvent,
  "organizationId",
  "eventType",
  "actorType",
  "actorId",
  "targetType",
  "targetId",
  "source",
  "metadata",
);

export type EventType = typeof EventType.Type;
export type ActorType = typeof ActorType.Type;
export type TargetType = typeof TargetType.Type;
export type EventSource = typeof EventSource.Type;
export type OrganizationEventMetadata = typeof OrganizationEventMetadata.Type;

export type OrganizationEvent = typeof OrganizationEvent.Type;
export type OrganizationEventInsert = typeof OrganizationEventInsert.Type;
