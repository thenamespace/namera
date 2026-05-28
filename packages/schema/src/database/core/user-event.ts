import { Schema } from "effect";

import { UserEventId, UserId } from "../../common";
import { createInsertSchema } from "../helpers";
import { TargetType, EventSource } from "./common";

export const UserEventType = Schema.String;
export const UserEventMetadata = Schema.StructWithRest(
  Schema.Struct({
    ipAddress: Schema.optionalKey(Schema.String),
    userAgent: Schema.optionalKey(Schema.String),
  }),
  [Schema.Record(Schema.String, Schema.String)],
);

export const UserEvent = Schema.Struct({
  id: UserEventId,
  userId: UserId,
  // What happened?
  eventType: UserEventType,
  // Target entity
  targetType: TargetType,
  targetId: Schema.String,
  // Tracking
  traceId: Schema.String,
  source: EventSource,
  metadata: UserEventMetadata,
  // Timestamps
  createdAt: Schema.Date,
});

export const UserEventInsert = createInsertSchema(
  UserEvent,
  "eventType",
  "targetType",
  "targetId",
  "traceId",
  "source",
  "metadata",
);

export type UserEventType = typeof UserEventType.Type;
export type UserEventMetadata = typeof UserEventMetadata.Type;

export type UserEvent = typeof UserEvent.Type;
export type UserEventInsert = typeof UserEventInsert.Type;
