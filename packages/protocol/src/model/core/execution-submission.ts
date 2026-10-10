import { Schema, Struct } from "effect";

import {
  ActorId,
  ExecutionSubmissionId,
  OrganizationId,
  SessionKeyGrantId,
  SessionKeyId,
  SessionKeyInstallationId,
} from "#/common/index";
import { EvmPreparedExecution, EvmSignedExecution, SupportedEvmChainId } from "#/evm/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";
import { EvmIntentCall } from "#/policy/evm/index";

export const ExecutionSubmissionStatus = Schema.Literals([
  "reserved",
  "prepared",
  "submitted",
  "confirmed",
  "failed",
]);

export const EvmExecutionSubmissionData = Schema.Struct({
  version: Schema.Literal(1),
  chainId: SupportedEvmChainId,
  calls: Schema.Array(EvmIntentCall),
  prepared: Schema.toCodecJson(EvmPreparedExecution),
  signedExecution: Schema.NullOr(EvmSignedExecution),
  broadcastAttempted: Schema.optionalKey(Schema.Literal(true)),
  managedSignerBinding: Schema.optionalKey(NonEmptyString),
});

const ExecutionSubmissionCommon = Schema.Struct({
  id: ExecutionSubmissionId,
  organizationId: OrganizationId,
  actorId: ActorId,
  sessionKeyGrantId: SessionKeyGrantId,
  sessionKeyId: SessionKeyId,
  installationId: SessionKeyInstallationId,
  expiresAt: Schema.DateTimeUtcFromDate,
  idempotencyKey: NonEmptyString,
  requestHash: NonEmptyString,
  policyHash: NonEmptyString,
  status: ExecutionSubmissionStatus,
  leaseToken: Schema.NullOr(NonEmptyString),
  leaseExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  submittedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  confirmedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  failedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const EvmExecutionSubmission = ExecutionSubmissionCommon.mapFields(
  Struct.assign({
    namespace: Schema.Literal("eip155"),
    data: EvmExecutionSubmissionData,
  }),
);

export const ExecutionSubmission = Schema.Union([EvmExecutionSubmission]);

export const ExecutionSubmissionInsert = createInsertSchema(
  ExecutionSubmission,
  "organizationId",
  "actorId",
  "sessionKeyGrantId",
  "sessionKeyId",
  "installationId",
  "expiresAt",
  "idempotencyKey",
  "requestHash",
  "policyHash",
  "namespace",
  "data",
);

export type ExecutionSubmissionStatus = typeof ExecutionSubmissionStatus.Type;
export type EvmExecutionSubmissionData = typeof EvmExecutionSubmissionData.Type;
export type EvmExecutionSubmission = typeof EvmExecutionSubmission.Type;
export type ExecutionSubmission = typeof ExecutionSubmission.Type;
export type ExecutionSubmissionEncoded = typeof ExecutionSubmission.Encoded;
export type ExecutionSubmissionInsert = typeof ExecutionSubmissionInsert.Type;
