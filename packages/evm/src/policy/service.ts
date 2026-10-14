import { DateTime, Effect } from "effect";

import { getEvmPolicyDefinitionFor, orderEvmPolicies } from "./registry.js";
import type { EvmPolicyService } from "./types.js";

/** API policies constrain signatures only; transactions use installed onchain permissions. */
export const makeEvmPolicyService = (): EvmPolicyService => ({
  authorizationDeadline: ({ policies, latest }) => {
    let deadline = latest;
    for (const policy of policies) {
      if (
        policy.type === "evm.time-window" &&
        DateTime.toEpochMillis(policy.expiresAt) < DateTime.toEpochMillis(deadline)
      )
        deadline = policy.expiresAt;
    }
    return deadline;
  },
  evaluateSignature: Effect.fn("evm.policy.evaluateSignature")(function* (input) {
    const operations = orderEvmPolicies(input.policies).map((policy) => ({
      policy,
      operation: getEvmPolicyDefinitionFor(policy).signature,
    }));
    if (!operations.some(({ operation }) => operation.grantsAccess))
      return { allowed: false, code: "SIGNATURE_POLICY_REQUIRED" } as const;
    for (const { policy, operation } of operations) {
      const decision = yield* operation.evaluate(policy, input.context);
      if (!decision.allowed) return decision;
    }
    return { allowed: true };
  }),
});
