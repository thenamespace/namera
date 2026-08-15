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
