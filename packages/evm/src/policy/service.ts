import { Effect, Schema } from "effect";

import { EvmPolicyError } from "@namera-ai/protocol";
import type {
  EvmNativeSpendLimitPolicy,
  EvmNativeSpendLimitPolicyReservation,
  EvmNativeSpendLimitPolicyState,
} from "@namera-ai/protocol";
import type { SessionKeyPolicyReservation, SessionKeyPolicyState } from "@namera-ai/protocol/model";

import { evmPolicyRegistry } from "./registry.js";
import type {
  EvmPolicyReservationInput,
  EvmPolicyReservationPlan,
  EvmPolicyService,
  EvmPolicyStateChange,
  EvmPolicyStateInput,
} from "./types.js";

const decodeStates = Effect.fn("evm.policy.native-spend-limit.decodeStates")(function* (
  policy: EvmNativeSpendLimitPolicy,
  states: ReadonlyArray<EvmPolicyStateInput>,
) {
  const decoded = new Map<string, EvmNativeSpendLimitPolicyState>();
  for (const state of states) {
    if (state.policyId !== policy.id) continue;
    decoded.set(
      state.stateKey,
      yield* Schema.decodeUnknownEffect(evmPolicyRegistry["evm.native-spend-limit"].stateSchema)(
        state.data,
      ).pipe(
        Effect.mapError(
          (cause) =>
            new EvmPolicyError({ code: "INVALID_POLICY_STATE", policyId: policy.id, cause }),
        ),
      ),
    );
  }
  return decoded;
});

const decodeReservations = Effect.fn("evm.policy.native-spend-limit.decodeReservations")(function* (
  policy: EvmNativeSpendLimitPolicy,
  reservations: ReadonlyArray<EvmPolicyReservationInput>,
) {
  const decoded = new Map<string, EvmNativeSpendLimitPolicyReservation>();
  for (const reservation of reservations) {
    if (reservation.policyId !== policy.id) continue;
    decoded.set(
      reservation.stateKey,
      yield* Schema.decodeUnknownEffect(
        evmPolicyRegistry["evm.native-spend-limit"].reservationSchema,
      )(reservation.data).pipe(
        Effect.mapError(
          (cause) =>
            new EvmPolicyError({
              code: "INVALID_POLICY_RESERVATION",
              policyId: policy.id,
              cause,
            }),
        ),
      ),
    );
  }
  return decoded;
});

const encodeStates = Effect.fn("evm.policy.native-spend-limit.encodeStates")(function* (
  policy: EvmNativeSpendLimitPolicy,
  states: ReadonlyMap<string, EvmNativeSpendLimitPolicyState>,
) {
  const changes: Array<EvmPolicyStateChange> = [];
  for (const [stateKey, state] of states) {
    const data = yield* Schema.encodeEffect(
      evmPolicyRegistry["evm.native-spend-limit"].stateSchema,
    )(state).pipe(
      Effect.mapError(
        (cause) => new EvmPolicyError({ code: "INVALID_POLICY_STATE", policyId: policy.id, cause }),
      ),
    );
    changes.push({
      policyId: policy.id,
      stateKey,
      stateVersion: policy.version,
      data: data as SessionKeyPolicyState["data"],
    });
  }
  return changes;
});

const encodeReservations = Effect.fn("evm.policy.native-spend-limit.encodeReservations")(function* (
  policy: EvmNativeSpendLimitPolicy,
  reservations: ReadonlyMap<string, EvmNativeSpendLimitPolicyReservation>,
) {
  const plans: Array<EvmPolicyReservationPlan> = [];
  for (const [stateKey, reservation] of reservations) {
    const data = yield* Schema.encodeEffect(
      evmPolicyRegistry["evm.native-spend-limit"].reservationSchema,
    )(reservation).pipe(
      Effect.mapError(
        (cause) =>
          new EvmPolicyError({
            code: "INVALID_POLICY_RESERVATION",
            policyId: policy.id,
            cause,
          }),
      ),
    );
    plans.push({
      policyId: policy.id,
      stateKey,
      reservationVersion: policy.version,
      data: data as SessionKeyPolicyReservation["data"],
    });
  }
  return plans;
});

export const makeEvmPolicyService = (): EvmPolicyService => ({
  evaluate: Effect.fn("evm.policy.evaluate")(function* (input) {
    for (const policy of input.policies) {
      const decision =
        policy.type === "evm.time-window"
          ? yield* evmPolicyRegistry["evm.time-window"].evaluate(policy, input.context)
          : yield* evmPolicyRegistry["evm.native-spend-limit"].evaluate(policy, input.context);
      if (!decision.allowed) return decision;
    }

    return { allowed: true };
  }),
  reserve: Effect.fn("evm.policy.reserve")(function* (input) {
    const stateChanges: Array<EvmPolicyStateChange> = [];
    const reservations: Array<EvmPolicyReservationPlan> = [];

    for (const policy of input.policies) {
      if (policy.type === "evm.time-window") {
        const decision = yield* evmPolicyRegistry["evm.time-window"].evaluate(
          policy,
          input.context,
        );
        if (!decision.allowed) {
          return { decision, stateChanges: [], reservations: [] };
        }
        continue;
      }

      const states = yield* decodeStates(policy, input.states);
      const result = yield* evmPolicyRegistry["evm.native-spend-limit"].reserve(
        policy,
        input.context,
        states,
      );
      if (!result.decision.allowed) {
        return { decision: result.decision, stateChanges: [], reservations: [] };
      }

      stateChanges.push(...(yield* encodeStates(policy, result.states)));
      reservations.push(...(yield* encodeReservations(policy, result.reservations)));
    }

    return { decision: { allowed: true }, stateChanges, reservations };
  }),
  settle: Effect.fn("evm.policy.settle")(function* (input) {
    const stateChanges: Array<EvmPolicyStateChange> = [];
    for (const policy of input.policies) {
      if (policy.type === "evm.time-window") continue;

      const states = yield* decodeStates(policy, input.states);
      const reservations = yield* decodeReservations(policy, input.reservations);
      const settled = yield* evmPolicyRegistry["evm.native-spend-limit"].settle(
        policy,
        states,
        reservations,
        input.result,
      );
      stateChanges.push(...(yield* encodeStates(policy, settled)));
    }
    return stateChanges;
  }),
  release: Effect.fn("evm.policy.release")(function* (input) {
    const stateChanges: Array<EvmPolicyStateChange> = [];
    for (const policy of input.policies) {
      if (policy.type === "evm.time-window") continue;

      const states = yield* decodeStates(policy, input.states);
      const reservations = yield* decodeReservations(policy, input.reservations);
      const released = yield* evmPolicyRegistry["evm.native-spend-limit"].release(
        policy,
        states,
        reservations,
      );
      stateChanges.push(...(yield* encodeStates(policy, released)));
    }
    return stateChanges;
  }),
});
