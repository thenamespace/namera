import type { Effect } from "effect";

import type { EvmPolicyDecision, EvmPolicyError, EvmSignatureContext } from "@namera-ai/protocol";
import type { EvmSessionKeyPolicy } from "@namera-ai/protocol/model";

export type EvmSignaturePolicyOperation = {
  readonly grantsAccess: boolean;
  readonly evaluate: (
    policy: EvmSessionKeyPolicy,
    context: EvmSignatureContext,
  ) => Effect.Effect<EvmPolicyDecision, EvmPolicyError>;
};
export type EvmPolicyDefinition<Type extends EvmSessionKeyPolicy["type"]> = {
  readonly type: Type;
  readonly applicability: "signature";
  readonly cardinality: "singleton";
  readonly priority: number;
  readonly signature: EvmSignaturePolicyOperation;
};
export const signatureStateless = <Policy extends EvmSessionKeyPolicy>(
  handler: {
    readonly type: Policy["type"];
    readonly evaluate: (
      policy: Policy,
      context: EvmSignatureContext,
    ) => Effect.Effect<EvmPolicyDecision, EvmPolicyError>;
  },
  options: { readonly grantsAccess: boolean },
): EvmSignaturePolicyOperation => ({
  grantsAccess: options.grantsAccess,
  evaluate: (policy, context) => {
    if (handler.type !== policy.type)
      throw new Error(
        `Policy registry mismatch: expected ${handler.type}, received ${policy.type}`,
      );
    return handler.evaluate(policy as Policy, context);
  },
});
