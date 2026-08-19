import { Schema, Struct } from "effect";

import {
  ExecutionSubmissionId,
  OrganizationId,
  PolicyId,
  SessionKeyId,
  SessionKeyPolicyReservationId,
  SignatureOperationId,
} from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const SessionKeyPolicyReservationStatus = Schema.Literals([
  "reserved",
  "submitted",
  "settled",
  "released",
]);

export const PolicyOperationReference = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("execution"),
    id: ExecutionSubmissionId,
  }),
  Schema.Struct({
    type: Schema.Literal("signature"),
    id: SignatureOperationId,
  }),
]);

const SessionKeyPolicyReservationFields = {
  id: SessionKeyPolicyReservationId,
  organizationId: OrganizationId,
  sessionKeyId: SessionKeyId,
  policyId: PolicyId,
  stateKey: NonEmptyString,
  reservationVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  data: Schema.Json,
  status: SessionKeyPolicyReservationStatus,
  expiresAt: Schema.DateTimeUtcFromDate,
  submittedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  settledAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  releasedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
};

export const ExecutionPolicyReservation = Schema.Struct({
  ...SessionKeyPolicyReservationFields,
  executionSubmissionId: ExecutionSubmissionId,
  signatureOperationId: Schema.Null,
}).mapFields(Struct.assign(TimestampFields));

export const SignaturePolicyReservation = Schema.Struct({
  ...SessionKeyPolicyReservationFields,
  executionSubmissionId: Schema.Null,
  signatureOperationId: SignatureOperationId,
}).mapFields(Struct.assign(TimestampFields));

export const SessionKeyPolicyReservation = Schema.Union([
  ExecutionPolicyReservation,
  SignaturePolicyReservation,
]);

export const SessionKeyPolicyReservationInsert = createInsertSchema(
  SessionKeyPolicyReservation,
  "organizationId",
  "sessionKeyId",
  "policyId",
  "executionSubmissionId",
  "signatureOperationId",
  "stateKey",
  "reservationVersion",
  "data",
  "expiresAt",
);

export type SessionKeyPolicyReservationStatus = typeof SessionKeyPolicyReservationStatus.Type;
export type PolicyOperationReference = typeof PolicyOperationReference.Type;
export type ExecutionPolicyReservation = typeof ExecutionPolicyReservation.Type;
export type SignaturePolicyReservation = typeof SignaturePolicyReservation.Type;
export type SessionKeyPolicyReservation = typeof SessionKeyPolicyReservation.Type;
export type SessionKeyPolicyReservationInsert = typeof SessionKeyPolicyReservationInsert.Type;
