import { DateTime, Effect } from "effect";

import {
  EvmNativeSpendLimitPolicy,
  EvmNativeSpendLimitPolicyReservation,
  EvmNativeSpendLimitPolicyState,
  EvmPolicyError,
  PolicyHandler,
  type EvmExecutionReceipt,
  type EvmIntentContext,
  type EvmNativeSpendLimit,
  type EvmNativeSpendLimitPeriod,
  type EvmPolicyDecision,
} from "@namera-ai/protocol";

type SuccessfulEvmExecutionReceipt = Extract<EvmExecutionReceipt, { readonly success: true }>;

type NativeSpendReservationResult = {
  readonly decision: EvmPolicyDecision;
  readonly states: ReadonlyMap<string, EvmNativeSpendLimitPolicyState>;
  readonly reservations: ReadonlyMap<string, EvmNativeSpendLimitPolicyReservation>;
};

type StatefulNativeSpendLimitPeriod = Exclude<EvmNativeSpendLimitPeriod, "operation">;

const getNativeSpendAmount = (context: EvmIntentContext) =>
  context.calls.reduce((total, call) => total + call.value, 0n);

const getApplicableLimits = (policy: EvmNativeSpendLimitPolicy, context: EvmIntentContext) =>
  policy.limits.filter((limit) => limit.chainId === context.chainId);

const getWindowStart = (
  timestamp: DateTime.Utc,
  period: Exclude<StatefulNativeSpendLimitPeriod, "lifetime">,
) =>
  period === "week"
    ? DateTime.startOf(timestamp, "week", { weekStartsOn: 1 })
    : DateTime.startOf(timestamp, period);

const getStateKey = (
  limit: EvmNativeSpendLimit & { readonly period: StatefulNativeSpendLimitPeriod },
  context: EvmIntentContext,
) =>
  limit.period === "lifetime"
    ? `${limit.chainId}:lifetime`
    : `${limit.chainId}:${limit.period}:${DateTime.toEpochMillis(
        getWindowStart(context.block.timestamp, limit.period),
      )}`;

const isStatefulLimit = (
  limit: EvmNativeSpendLimit,
): limit is EvmNativeSpendLimit & { readonly period: StatefulNativeSpendLimitPeriod } =>
  limit.period !== "operation";

const evaluateNativeSpend = (
  policy: EvmNativeSpendLimitPolicy,
  context: EvmIntentContext,
): EvmPolicyDecision => {
  const amount = getNativeSpendAmount(context);
  const limits = getApplicableLimits(policy, context);
  if (limits.length === 0) {
    return amount === 0n
      ? { allowed: true }
      : {
          allowed: false,
          policyId: policy.id,
          code: "NATIVE_SPEND_CHAIN_NOT_CONFIGURED",
        };
  }

  if (limits.some((limit) => amount > limit.maxAmount)) {
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

  override readonly initialStates = Effect.fn("evm.policy.native-spend-limit.initial-states")(
    (policy: EvmNativeSpendLimitPolicy, context: EvmIntentContext) => {
      if (getNativeSpendAmount(context) === 0n) return Effect.succeed(new Map());

      return Effect.succeed(
        new Map(
          getApplicableLimits(policy, context)
            .filter(isStatefulLimit)
            .map((limit) => [
              getStateKey(limit, context),
              { version: 1 as const, spent: 0n, reserved: 0n },
            ]),
        ),
      );
    },
  );

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

      const amount = getNativeSpendAmount(context);
      const limits = getApplicableLimits(policy, context).filter(isStatefulLimit);
      if (amount === 0n || limits.length === 0) {
        return Effect.succeed({ decision, states: new Map(), reservations: new Map() });
      }

      const stateChanges = new Map<string, EvmNativeSpendLimitPolicyState>();
      const reservations = new Map<string, EvmNativeSpendLimitPolicyReservation>();
      for (const limit of limits) {
        const stateKey = getStateKey(limit, context);
        const state = states.get(stateKey) ?? {
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

        stateChanges.set(stateKey, { ...state, reserved: state.reserved + amount });
        reservations.set(stateKey, { version: 1, amount });
      }

      return Effect.succeed({
        decision: { allowed: true },
        states: stateChanges,
        reservations,
      });
    },
  );

  override readonly settle = Effect.fn("evm.policy.native-spend-limit.settle")(function* (
    policy: EvmNativeSpendLimitPolicy,
    states: ReadonlyMap<string, EvmNativeSpendLimitPolicyState>,
    reservations: ReadonlyMap<string, EvmNativeSpendLimitPolicyReservation>,
    _result: SuccessfulEvmExecutionReceipt,
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

      changes.set(stateKey, {
        ...state,
        spent: state.spent + reservation.amount,
        reserved: state.reserved - reservation.amount,
      });
    }

    return changes;
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
