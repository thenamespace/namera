import { DateTime, Effect } from "effect";

import { getEvmPolicyDefinitionFor, orderEvmPolicies } from "./registry.js";
import type {
  EvmPolicyReservationPlan,
  EvmPolicyService,
  EvmPolicyStateChange,
  EvmPolicyStateSeed,
} from "./types.js";

export const makeEvmPolicyService = (): EvmPolicyService => ({
  executionDeadline: ({ policies, latest }) => {
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
  evaluate: Effect.fn("evm.policy.evaluate")(function* (input) {
    for (const policy of orderEvmPolicies(input.policies)) {
      const operation = getEvmPolicyDefinitionFor(policy).execution;
      if (operation.kind === "not-applicable") continue;

      const decision = yield* operation.evaluate(policy, input.context);
      if (!decision.allowed) return decision;
    }

    return { allowed: true };
  }),
  evaluateSignature: Effect.fn("evm.policy.evaluateSignature")(function* (input) {
    const operations = orderEvmPolicies(input.policies).map((policy) => ({
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
  getStateSeeds: Effect.fn("evm.policy.getStateSeeds")(function* (input) {
    const seeds: Array<EvmPolicyStateSeed> = [];
    for (const policy of orderEvmPolicies(input.policies)) {
      const operation = getEvmPolicyDefinitionFor(policy).execution;
      if (operation.kind !== "stateful") continue;
      seeds.push(...(yield* operation.getStateSeeds(policy, input.context)));
    }
    return seeds;
  }),
  reserve: Effect.fn("evm.policy.reserve")(function* (input) {
    const stateChanges: Array<EvmPolicyStateChange> = [];
    const reservations: Array<EvmPolicyReservationPlan> = [];

    for (const policy of orderEvmPolicies(input.policies)) {
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
    for (const policy of orderEvmPolicies(input.policies)) {
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
    for (const policy of orderEvmPolicies(input.policies)) {
      const operation = getEvmPolicyDefinitionFor(policy).execution;
      if (operation.kind !== "stateful") continue;

      stateChanges.push(...(yield* operation.release(policy, input.states, input.reservations)));
    }
    return stateChanges;
  }),
});
