import { Schema, Struct } from "effect";

import {
  ExecutionId,
  OrganizationId,
  PolicyId,
  SessionKeyId,
  SessionKeyPolicyReservationId,
} from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const SessionKeyPolicyReservationStatus = Schema.Literals([
  "reserved",
  "submitted",
  "settled",
  "released",
]);

export const SessionKeyPolicyReservation = Schema.Struct({
  id: SessionKeyPolicyReservationId,
  organizationId: OrganizationId,
  sessionKeyId: SessionKeyId,
  policyId: PolicyId,
  executionId: ExecutionId,
  stateKey: NonEmptyString,
  reservationVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  data: Schema.Json,
  status: SessionKeyPolicyReservationStatus,
  expiresAt: Schema.DateTimeUtcFromDate,
  submittedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  settledAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  releasedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const SessionKeyPolicyReservationInsert = createInsertSchema(
  SessionKeyPolicyReservation,
  "organizationId",
  "sessionKeyId",
  "policyId",
  "executionId",
  "stateKey",
  "reservationVersion",
  "data",
  "expiresAt",
);

export type SessionKeyPolicyReservationStatus = typeof SessionKeyPolicyReservationStatus.Type;
export type SessionKeyPolicyReservation = typeof SessionKeyPolicyReservation.Type;
export type SessionKeyPolicyReservationInsert = typeof SessionKeyPolicyReservationInsert.Type;
