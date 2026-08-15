import { Schema } from "effect";

import { PolicyId } from "#/common/index";

export const EvmPolicyDenialCode = Schema.Literals([
  "TIME_WINDOW_NOT_STARTED",
  "TIME_WINDOW_EXPIRED",
  "NATIVE_SPEND_CHAIN_NOT_CONFIGURED",
  "NATIVE_SPEND_LIMIT_EXCEEDED",
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

export type EvmPolicyDenialCode = typeof EvmPolicyDenialCode.Type;
export type EvmPolicyDecision = typeof EvmPolicyDecision.Type;
