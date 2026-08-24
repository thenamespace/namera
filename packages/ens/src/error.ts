import { Schema } from "effect";

export const EnsOperation = Schema.Literals([
  "configure",
  "createSubname",
  "updateSubname",
  "deleteSubname",
  "isSubnameAvailable",
  "getSingleSubname",
  "getFilteredSubnames",
  "addAddressRecord",
  "deleteAddressRecord",
  "setDefaultEvmAddress",
  "addTextRecord",
  "deleteTextRecord",
  "getTextRecords",
  "getTextRecord",
  "addDataRecord",
  "deleteDataRecord",
  "getDataRecords",
  "getDataRecord",
]);
export type EnsOperation = typeof EnsOperation.Type;

export const EnsErrorReason = Schema.Literals([
  "AUTHENTICATION_FAILED",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "ALREADY_EXISTS",
  "RATE_LIMITED",
  "REQUEST_FAILED",
]);
export type EnsErrorReason = typeof EnsErrorReason.Type;

export class EnsError extends Schema.TaggedError<EnsError>()("EnsError", {
  operation: EnsOperation,
  reason: EnsErrorReason,
  cause: Schema.Defect(),
}) {}
