import { Schema } from "effect";

import { PolicyId } from "#/common/index";

export const EvmPolicyDenialCode = Schema.Literals([
  "TIME_WINDOW_NOT_STARTED",
  "TIME_WINDOW_EXPIRED",
  "NATIVE_SPEND_CHAIN_NOT_CONFIGURED",
  "NATIVE_SPEND_LIMIT_EXCEEDED",
  "SIGNATURE_TYPE_NOT_ALLOWED",
]);

export const EvmPolicyDecision = Schema.Union([
  Schema.Struct({ allowed: Schema.Literal(true) }),
  Schema.Struct({
    allowed: Schema.Literal(false),
    policyId: PolicyId,
    code: EvmPolicyDenialCode,
  }),
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
export type EvmPolicyDecision = typeof EvmPolicyDecision.Type;
export type EvmSignaturePolicyDecision = typeof EvmSignaturePolicyDecision.Type;
