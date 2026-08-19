import { Effect } from "effect";

import { getEvmPolicyDefinitionFor } from "./registry.js";
import type { EvmPolicyReservationPlan, EvmPolicyService, EvmPolicyStateChange } from "./types.js";

export const makeEvmPolicyService = (): EvmPolicyService => ({
  evaluate: Effect.fn("evm.policy.evaluate")(function* (input) {
    for (const policy of input.policies) {
      const operation = getEvmPolicyDefinitionFor(policy).execution;
      if (operation.kind === "not-applicable") continue;

      const decision = yield* operation.evaluate(policy, input.context);
      if (!decision.allowed) return decision;
    }

    return { allowed: true };
  }),
  evaluateSignature: Effect.fn("evm.policy.evaluateSignature")(function* (input) {
    const operations = input.policies.map((policy) => ({
      policy,
      operation: getEvmPolicyDefinitionFor(policy).signature,
    }));
    if (
      !operations.some(({ operation }) => operation.kind === "stateless" && operation.grantsAccess)
    ) {
      return { allowed: false, code: "SIGNATURE_POLICY_REQUIRED" } as const;
    }

    for (const { policy, operation } of operations) {
      if (operation.kind === "not-applicable") continue;

      const decision = yield* operation.evaluate(policy, input.context);
      if (!decision.allowed) return decision;
    }

    return { allowed: true };
  }),
  reserve: Effect.fn("evm.policy.reserve")(function* (input) {
    const stateChanges: Array<EvmPolicyStateChange> = [];
    const reservations: Array<EvmPolicyReservationPlan> = [];

    for (const policy of input.policies) {
      const operation = getEvmPolicyDefinitionFor(policy).execution;
      if (operation.kind === "not-applicable") continue;
      if (operation.kind === "stateless") {
        const decision = yield* operation.evaluate(policy, input.context);
        if (!decision.allowed) {
          return { decision, stateChanges: [], reservations: [] };
        }
        continue;
      }

      const result = yield* operation.reserve(policy, input.context, input.states);
      if (!result.decision.allowed) {
        return { decision: result.decision, stateChanges: [], reservations: [] };
      }
      stateChanges.push(...result.stateChanges);
      reservations.push(...result.reservations);
    }

    return { decision: { allowed: true }, stateChanges, reservations };
  }),
  settle: Effect.fn("evm.policy.settle")(function* (input) {
    const stateChanges: Array<EvmPolicyStateChange> = [];
    for (const policy of input.policies) {
      const operation = getEvmPolicyDefinitionFor(policy).execution;
      if (operation.kind !== "stateful") continue;

      stateChanges.push(
        ...(yield* operation.settle(policy, input.states, input.reservations, input.result)),
      );
    }
    return stateChanges;
  }),
  release: Effect.fn("evm.policy.release")(function* (input) {
    const stateChanges: Array<EvmPolicyStateChange> = [];
    for (const policy of input.policies) {
      const operation = getEvmPolicyDefinitionFor(policy).execution;
      if (operation.kind !== "stateful") continue;

      stateChanges.push(...(yield* operation.release(policy, input.states, input.reservations)));
    }
    return stateChanges;
  }),
});
