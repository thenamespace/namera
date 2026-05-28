import { Schema } from "effect";

import { OrganizationEventId, OrganizationId } from "../../common";
import { createInsertSchema } from "../helpers";
import { EventSource, TargetType } from "./common";

export const EventType = Schema.String;
export const ActorType = Schema.Literals(["user"]);
export const OrganizationEventMetadata = Schema.StructWithRest(
  Schema.Struct({
    ipAddress: Schema.optionalKey(Schema.String),
    userAgent: Schema.optionalKey(Schema.String),
  }),
  [Schema.Record(Schema.String, Schema.String)],
);

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
  "traceId",
  "source",
  "metadata",
);

export type EventType = typeof EventType.Type;
export type ActorType = typeof ActorType.Type;
export type OrganizationEventMetadata = typeof OrganizationEventMetadata.Type;
export type OrganizationEvent = typeof OrganizationEvent.Type;
export type OrganizationEventInsert = typeof OrganizationEventInsert.Type;
