import { Schema, Struct } from "effect";

import { OrganizationId, SessionId, UserId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const Session = Schema.Struct({
  id: SessionId,
  userId: UserId,
  tokenHash: NonEmptyString,
  activeOrganizationId: Schema.NullOr(OrganizationId),
  ipAddress: Schema.NullOr(Schema.String),
  userAgent: Schema.NullOr(Schema.String),
  expiresAt: Schema.DateTimeUtcFromDate,
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const SessionUpdate = createUpdateSchema(Session);
export const SessionInsert = createInsertSchema(Session, "userId", "tokenHash", "expiresAt");

export type Session = typeof Session.Type;
export type SessionUpdate = typeof SessionUpdate.Type;
export type SessionInsert = typeof SessionInsert.Type;
