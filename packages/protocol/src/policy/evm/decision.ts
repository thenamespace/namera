import { Schema } from "effect";

import { PolicyId } from "#/common/index";

export const EvmPolicyDenialCode = Schema.Literals([
  "TIME_WINDOW_NOT_STARTED",
  "TIME_WINDOW_EXPIRED",
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
