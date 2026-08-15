import { Effect } from "effect";

import type { EvmPolicyDecision } from "@namera-ai/protocol";

import { evmPolicyRegistry } from "./registry.js";
import type { EvmPolicyService } from "./types.js";

export const makeEvmPolicyService = (): EvmPolicyService => ({
  evaluate: Effect.fn("evm.policy.evaluate")(function* (input) {
    for (const policy of input.policies) {
      const decision = yield* evmPolicyRegistry[policy.type].evaluate(policy, input.context);
      if (!decision.allowed) return decision;
    }

    return { allowed: true } satisfies EvmPolicyDecision;
  }),
});
