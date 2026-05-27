import { Schema, Struct } from "effect";

import { SessionId, UserId, OrganizationId } from "@/common";
import { TimestampFields } from "@/database/common";
import { createInsertSchema, createUpdateSchema } from "@/database/helpers";

export const SessionMetadata = Schema.Struct({
  ipAddress: Schema.NullOr(Schema.String),
  userAgent: Schema.NullOr(Schema.String),
});

export const Session = Schema.Struct({
  id: SessionId,
  userId: UserId,
  token: Schema.String,
  activeOrganizationId: Schema.NullOr(OrganizationId),
  metadata: SessionMetadata,
  expiresAt: Schema.DateTimeUtcFromDate,
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const SessionUpdate = createUpdateSchema(Session);
export const SessionInsert = createInsertSchema(
  Session,
  "userId",
  "token",
  "activeOrganizationId",
  "metadata",
  "expiresAt",
);

export type Session = typeof Session.Type;
export type SessionUpdate = typeof SessionUpdate.Type;
export type SessionInsert = typeof SessionInsert.Type;
