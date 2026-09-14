import { Schema } from "effect";

import { PolicyId } from "#/common/index";

export const EvmPolicyDenialCode = Schema.Literals([
  "TIME_WINDOW_NOT_STARTED",
  "TIME_WINDOW_EXPIRED",
  "CHAIN_NOT_ALLOWED",
  "GAS_BUDGET_CHAIN_NOT_CONFIGURED",
  "GAS_BUDGET_EXCEEDED",
  "NATIVE_SPEND_CHAIN_NOT_CONFIGURED",
  "NATIVE_SPEND_LIMIT_EXCEEDED",
  "SIGNATURE_TYPE_NOT_ALLOWED",
  "TYPED_DATA_NOT_ALLOWED",
  "CALL_NOT_ALLOWED",
  "TOKEN_CALL_NOT_ALLOWED",
  "TOKEN_SPEND_LIMIT_EXCEEDED",
]);

export const EvmPolicyAllowedDecision = Schema.Struct({ allowed: Schema.Literal(true) });

export const EvmPolicyDeniedDecision = Schema.Struct({
  allowed: Schema.Literal(false),
  policyId: PolicyId,
  code: EvmPolicyDenialCode,
}).annotate({
  identifier: "EvmPolicyDeniedDecision",
  description: "A bounded policy denial attributed to the exact policy instance",
});

export const EvmPolicyDecision = Schema.Union([
  EvmPolicyAllowedDecision,
  EvmPolicyDeniedDecision,
]).annotate({
  identifier: "EvmPolicyDecision",
  description: "The result of evaluating one complete EVM policy set",
});

export const EvmSignaturePolicyDecision = Schema.Union([
  EvmPolicyDecision,
  Schema.Struct({
    allowed: Schema.Literal(false),
    code: Schema.Literal("SIGNATURE_POLICY_REQUIRED"),
  }),
]).annotate({
  identifier: "EvmSignaturePolicyDecision",
  description: "The result of evaluating EVM policies for a signature request",
});

export type EvmPolicyDenialCode = typeof EvmPolicyDenialCode.Type;
export type EvmPolicyAllowedDecision = typeof EvmPolicyAllowedDecision.Type;
export type EvmPolicyDeniedDecision = typeof EvmPolicyDeniedDecision.Type;
export type EvmPolicyDecision = typeof EvmPolicyDecision.Type;
export type EvmSignaturePolicyDecision = typeof EvmSignaturePolicyDecision.Type;
