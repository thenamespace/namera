import { Schema } from "effect";

export const EvmExecutionErrorCode = Schema.Literals([
  "ACCOUNT_RECONSTRUCTION_FAILED",
  "ACCOUNT_ADDRESS_MISMATCH",
  "PREPARATION_FAILED",
  "SIMULATION_FAILED",
  "SIGNING_FAILED",
  "SUBMISSION_REJECTED",
  "SUBMISSION_UNKNOWN",
  "SUBMISSION_HASH_MISMATCH",
  "RECEIPT_LOOKUP_FAILED",
]);

export class EvmExecutionError extends Schema.TaggedError<EvmExecutionError>()(
  "EvmExecutionError",
  {
    code: EvmExecutionErrorCode,
    cause: Schema.Defect(),
  },
) {}

export type EvmExecutionErrorCode = typeof EvmExecutionErrorCode.Type;

export const ExecutionErrorCode = Schema.Literals([
  "NO_AUTHORIZED_SESSION_KEY",
  "POLICY_DENIED",
  "IDEMPOTENCY_CONFLICT",
  "EXECUTION_FAILED",
  "EXECUTION_UNAVAILABLE",
]);

export class ExecutionError extends Schema.TaggedError<ExecutionError>()(
  "ExecutionError",
  {
    code: ExecutionErrorCode,
    policyCode: Schema.optional(Schema.String),
  },
  { httpApiStatus: 409 },
) {}

export type ExecutionErrorCode = typeof ExecutionErrorCode.Type;

export class ExecutionSubmissionNotFoundError extends Schema.TaggedError<ExecutionSubmissionNotFoundError>()(
  "ExecutionSubmissionNotFoundError",
  { code: Schema.Literal("EXECUTION_SUBMISSION_NOT_FOUND") },
  { httpApiStatus: 404 },
) {}

export class ExecutionNotFoundError extends Schema.TaggedError<ExecutionNotFoundError>()(
  "ExecutionNotFoundError",
  { code: Schema.Literal("EXECUTION_NOT_FOUND") },
  { httpApiStatus: 404 },
) {}
