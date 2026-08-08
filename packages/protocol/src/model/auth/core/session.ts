import { Schema, Struct } from "effect";

import { OrganizationId, SessionId, UserId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";

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

export const SessionInsert = Schema.Struct({
  userId: UserId,
  tokenHash: NonEmptyString,
  ipAddress: Schema.optionalKey(Schema.String),
  userAgent: Schema.optionalKey(Schema.String),
  expiresAt: Schema.DateTimeUtcFromDate,
});

export const SessionUpdate = Schema.Struct({
  expiresAt: Schema.optionalKey(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.optionalKey(Schema.NullOr(Schema.DateTimeUtcFromDate)),
});

export type Session = typeof Session.Type;
export type SessionUpdate = typeof SessionUpdate.Type;
export type SessionInsert = typeof SessionInsert.Type;
