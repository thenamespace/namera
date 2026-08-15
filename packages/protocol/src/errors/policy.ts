import { Schema } from "effect";

import { PolicyId } from "#/common/index";

export const EvmPolicyErrorCode = Schema.Literals([
  "INVALID_POLICY_STATE",
  "INVALID_POLICY_RESERVATION",
  "MISSING_POLICY_STATE",
  "MISSING_POLICY_RESERVATION",
]);

export class EvmPolicyError extends Schema.TaggedError<EvmPolicyError>()("EvmPolicyError", {
  code: EvmPolicyErrorCode,
  policyId: PolicyId,
  cause: Schema.Defect(),
}) {}

export type EvmPolicyErrorCode = typeof EvmPolicyErrorCode.Type;
