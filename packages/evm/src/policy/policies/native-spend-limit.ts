import { Effect } from "effect";

import {
  EvmNativeSpendLimitPolicy,
  EvmNativeSpendLimitPolicyReservation,
  EvmNativeSpendLimitPolicyState,
  EvmPolicyError,
  PolicyHandler,
  type EvmExecutionReceipt,
  type EvmIntentContext,
  type EvmPolicyDecision,
} from "@namera-ai/protocol";

type SuccessfulEvmExecutionReceipt = Extract<EvmExecutionReceipt, { readonly success: true }>;

type NativeSpendReservationResult = {
  readonly decision: EvmPolicyDecision;
  readonly states: ReadonlyMap<string, EvmNativeSpendLimitPolicyState>;
  readonly reservations: ReadonlyMap<string, EvmNativeSpendLimitPolicyReservation>;
};

const evaluateNativeSpend = (
  policy: EvmNativeSpendLimitPolicy,
  context: EvmIntentContext,
): EvmPolicyDecision => {
  const limit = policy.limits.find((item) => item.chainId === context.chainId);
  if (limit === undefined) {
    return {
      allowed: false,
      policyId: policy.id,
      code: "NATIVE_SPEND_CHAIN_NOT_CONFIGURED",
    };
  }

  const amount = context.calls.reduce((total, call) => total + call.value, 0n);
  if (amount > limit.maxAmount) {
    return { allowed: false, policyId: policy.id, code: "NATIVE_SPEND_LIMIT_EXCEEDED" };
  }

  return { allowed: true };
};

export class EvmNativeSpendLimitPolicyHandler extends PolicyHandler<
  EvmNativeSpendLimitPolicy,
  EvmIntentContext,
  EvmPolicyDecision,
  EvmNativeSpendLimitPolicyState,
  EvmNativeSpendLimitPolicyReservation,
  SuccessfulEvmExecutionReceipt,
  EvmPolicyError
> {
  readonly type = "evm.native-spend-limit";
  readonly policySchema = EvmNativeSpendLimitPolicy;
  override readonly stateSchema = EvmNativeSpendLimitPolicyState;
  override readonly reservationSchema = EvmNativeSpendLimitPolicyReservation;

  readonly evaluate = Effect.fn("evm.policy.native-spend-limit.evaluate")(
    (
      policy: EvmNativeSpendLimitPolicy,
      context: EvmIntentContext,
    ): Effect.Effect<EvmPolicyDecision> => Effect.succeed(evaluateNativeSpend(policy, context)),
  );

  override readonly reserve = Effect.fn("evm.policy.native-spend-limit.reserve")(
    (
      policy: EvmNativeSpendLimitPolicy,
      context: EvmIntentContext,
      states: ReadonlyMap<string, EvmNativeSpendLimitPolicyState>,
    ): Effect.Effect<NativeSpendReservationResult> => {
      const decision = evaluateNativeSpend(policy, context);
      if (!decision.allowed) {
        return Effect.succeed({ decision, states: new Map(), reservations: new Map() });
      }

      const limit = policy.limits.find((item) => item.chainId === context.chainId);
      if (limit === undefined) {
        return Effect.succeed({
          decision: {
            allowed: false,
            policyId: policy.id,
            code: "NATIVE_SPEND_CHAIN_NOT_CONFIGURED",
          },
          states: new Map(),
          reservations: new Map(),
        });
      }

      const amount = context.calls.reduce((total, call) => total + call.value, 0n);
      const state = states.get(context.chainId) ?? {
        version: 1 as const,
        spent: 0n,
        reserved: 0n,
      };

      if (state.spent + state.reserved + amount > limit.maxAmount) {
        return Effect.succeed({
          decision: {
            allowed: false,
            policyId: policy.id,
            code: "NATIVE_SPEND_LIMIT_EXCEEDED",
          },
          states: new Map(),
          reservations: new Map(),
        });
      }

      return Effect.succeed({
        decision: { allowed: true },
        states: new Map([[context.chainId, { ...state, reserved: state.reserved + amount }]]),
        reservations: new Map([[context.chainId, { version: 1, amount }]]),
      });
    },
  );

  override readonly settle = Effect.fn("evm.policy.native-spend-limit.settle")(function* (
    policy: EvmNativeSpendLimitPolicy,
    states: ReadonlyMap<string, EvmNativeSpendLimitPolicyState>,
    reservations: ReadonlyMap<string, EvmNativeSpendLimitPolicyReservation>,
    result: SuccessfulEvmExecutionReceipt,
  ) {
    const state = states.get(result.chainId);
    const reservation = reservations.get(result.chainId);
    if (state === undefined) {
      return yield* new EvmPolicyError({
        code: "MISSING_POLICY_STATE",
        policyId: policy.id,
        cause: new Error(`Missing policy state for ${result.chainId}`),
      });
    }
    if (reservation === undefined) {
      return yield* new EvmPolicyError({
        code: "MISSING_POLICY_RESERVATION",
        policyId: policy.id,
        cause: new Error(`Missing policy reservation for ${result.chainId}`),
      });
    }
    if (state.reserved < reservation.amount) {
      return yield* new EvmPolicyError({
        code: "INVALID_POLICY_STATE",
        policyId: policy.id,
        cause: new Error("Reserved native value is smaller than the reservation"),
      });
    }

    return new Map([
      [
        result.chainId,
        {
          ...state,
          spent: state.spent + reservation.amount,
          reserved: state.reserved - reservation.amount,
        },
      ],
    ]);
  });

  override readonly release = Effect.fn("evm.policy.native-spend-limit.release")(function* (
    policy: EvmNativeSpendLimitPolicy,
    states: ReadonlyMap<string, EvmNativeSpendLimitPolicyState>,
    reservations: ReadonlyMap<string, EvmNativeSpendLimitPolicyReservation>,
  ) {
    const changes = new Map<string, EvmNativeSpendLimitPolicyState>();
    for (const [stateKey, reservation] of reservations) {
      const state = states.get(stateKey);
      if (state === undefined) {
        return yield* new EvmPolicyError({
          code: "MISSING_POLICY_STATE",
          policyId: policy.id,
          cause: new Error(`Missing policy state for ${stateKey}`),
        });
      }
      if (state.reserved < reservation.amount) {
        return yield* new EvmPolicyError({
          code: "INVALID_POLICY_STATE",
          policyId: policy.id,
          cause: new Error("Reserved native value is smaller than the reservation"),
        });
      }

      changes.set(stateKey, { ...state, reserved: state.reserved - reservation.amount });
    }

    return changes;
  });
}
