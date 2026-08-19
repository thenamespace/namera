import { DateTime, Effect } from "effect";

import {
  EvmGasBudgetPolicy,
  EvmGasBudgetPolicyReservation,
  EvmGasBudgetPolicyState,
  EvmPolicyError,
  PolicyHandler,
  type EvmExecutionReceipt,
  type EvmGasBudget,
  type EvmGasBudgetPeriod,
  type EvmIntentContext,
  type EvmPolicyDecision,
} from "@namera-ai/protocol";

type SuccessfulEvmExecutionReceipt = Extract<EvmExecutionReceipt, { readonly success: true }>;

type GasBudgetReservationResult = {
  readonly decision: EvmPolicyDecision;
  readonly states: ReadonlyMap<string, EvmGasBudgetPolicyState>;
  readonly reservations: ReadonlyMap<string, EvmGasBudgetPolicyReservation>;
};

const getApplicableBudgets = (policy: EvmGasBudgetPolicy, context: EvmIntentContext) =>
  policy.budgets.filter((budget) => budget.chainId === context.chainId);

const getMaximumGasCost = (context: EvmIntentContext) => {
  const gas = context.userOperation.gas;
  const maximumGas =
    gas.callGasLimit +
    gas.verificationGasLimit +
    gas.preVerificationGas +
    gas.paymasterVerificationGasLimit +
    gas.paymasterPostOpGasLimit;
  return maximumGas * gas.maxFeePerGas;
};

const getWindowStart = (
  timestamp: DateTime.Utc,
  period: Exclude<EvmGasBudgetPeriod, "lifetime">,
) =>
  period === "week"
    ? DateTime.startOf(timestamp, "week", { weekStartsOn: 1 })
    : DateTime.startOf(timestamp, period);

const getStateKey = (budget: EvmGasBudget, context: EvmIntentContext) =>
  budget.period === "lifetime"
    ? `${budget.chainId}:lifetime`
    : `${budget.chainId}:${budget.period}:${DateTime.toEpochMillis(
        getWindowStart(context.block.timestamp, budget.period),
      )}`;

const evaluateGasBudget = (
  policy: EvmGasBudgetPolicy,
  context: EvmIntentContext,
): EvmPolicyDecision => {
  const budgets = getApplicableBudgets(policy, context);
  if (budgets.length === 0) {
    return {
      allowed: false,
      policyId: policy.id,
      code: "GAS_BUDGET_CHAIN_NOT_CONFIGURED",
    };
  }

  const maximumCost = getMaximumGasCost(context);
  return budgets.some((budget) => maximumCost > budget.maxCost)
    ? { allowed: false, policyId: policy.id, code: "GAS_BUDGET_EXCEEDED" }
    : { allowed: true };
};

export class EvmGasBudgetPolicyHandler extends PolicyHandler<
  EvmGasBudgetPolicy,
  EvmIntentContext,
  EvmPolicyDecision,
  EvmGasBudgetPolicyState,
  EvmGasBudgetPolicyReservation,
  SuccessfulEvmExecutionReceipt,
  EvmPolicyError
> {
  readonly type = "evm.gas-budget";
  readonly policySchema = EvmGasBudgetPolicy;
  override readonly stateSchema = EvmGasBudgetPolicyState;
  override readonly reservationSchema = EvmGasBudgetPolicyReservation;

  override readonly initialStates = Effect.fn("evm.policy.gas-budget.initial-states")(
    (policy: EvmGasBudgetPolicy, context: EvmIntentContext) =>
      Effect.succeed(
        new Map(
          getApplicableBudgets(policy, context).map((budget) => [
            getStateKey(budget, context),
            { version: 1 as const, spent: 0n, reserved: 0n },
          ]),
        ),
      ),
  );

  readonly evaluate = Effect.fn("evm.policy.gas-budget.evaluate")(
    (policy: EvmGasBudgetPolicy, context: EvmIntentContext) =>
      Effect.succeed(evaluateGasBudget(policy, context)),
  );

  override readonly reserve = Effect.fn("evm.policy.gas-budget.reserve")(
    (
      policy: EvmGasBudgetPolicy,
      context: EvmIntentContext,
      states: ReadonlyMap<string, EvmGasBudgetPolicyState>,
    ): Effect.Effect<GasBudgetReservationResult> => {
      const decision = evaluateGasBudget(policy, context);
      if (!decision.allowed) {
        return Effect.succeed({ decision, states: new Map(), reservations: new Map() });
      }

      const maximumCost = getMaximumGasCost(context);
      const stateChanges = new Map<string, EvmGasBudgetPolicyState>();
      const reservations = new Map<string, EvmGasBudgetPolicyReservation>();
      for (const budget of getApplicableBudgets(policy, context)) {
        const stateKey = getStateKey(budget, context);
        const state = states.get(stateKey) ?? {
          version: 1 as const,
          spent: 0n,
          reserved: 0n,
        };

        if (state.spent + state.reserved + maximumCost > budget.maxCost) {
          return Effect.succeed({
            decision: { allowed: false, policyId: policy.id, code: "GAS_BUDGET_EXCEEDED" },
            states: new Map(),
            reservations: new Map(),
          });
        }

        stateChanges.set(stateKey, { ...state, reserved: state.reserved + maximumCost });
        reservations.set(stateKey, { version: 1, maxCost: maximumCost });
      }

      return Effect.succeed({
        decision: { allowed: true },
        states: stateChanges,
        reservations,
      });
    },
  );

  override readonly settle = Effect.fn("evm.policy.gas-budget.settle")(function* (
    policy: EvmGasBudgetPolicy,
    states: ReadonlyMap<string, EvmGasBudgetPolicyState>,
    reservations: ReadonlyMap<string, EvmGasBudgetPolicyReservation>,
    result: SuccessfulEvmExecutionReceipt,
  ) {
    const changes = new Map<string, EvmGasBudgetPolicyState>();
    for (const [stateKey, reservation] of reservations) {
      const state = states.get(stateKey);
      if (state === undefined) {
        return yield* new EvmPolicyError({
          code: "MISSING_POLICY_STATE",
          policyId: policy.id,
          cause: new Error(`Missing policy state for ${stateKey}`),
        });
      }
      if (state.reserved < reservation.maxCost || result.actualGasCost > reservation.maxCost) {
        return yield* new EvmPolicyError({
          code: "INVALID_POLICY_STATE",
          policyId: policy.id,
          cause: new Error("Actual or reserved gas cost exceeds the pessimistic reservation"),
        });
      }

      changes.set(stateKey, {
        ...state,
        spent: state.spent + result.actualGasCost,
        reserved: state.reserved - reservation.maxCost,
      });
    }

    return changes;
  });

  override readonly release = Effect.fn("evm.policy.gas-budget.release")(function* (
    policy: EvmGasBudgetPolicy,
    states: ReadonlyMap<string, EvmGasBudgetPolicyState>,
    reservations: ReadonlyMap<string, EvmGasBudgetPolicyReservation>,
  ) {
    const changes = new Map<string, EvmGasBudgetPolicyState>();
    for (const [stateKey, reservation] of reservations) {
      const state = states.get(stateKey);
      if (state === undefined) {
        return yield* new EvmPolicyError({
          code: "MISSING_POLICY_STATE",
          policyId: policy.id,
          cause: new Error(`Missing policy state for ${stateKey}`),
        });
      }
      if (state.reserved < reservation.maxCost) {
        return yield* new EvmPolicyError({
          code: "INVALID_POLICY_STATE",
          policyId: policy.id,
          cause: new Error("Reserved gas cost is smaller than the reservation"),
        });
      }

      changes.set(stateKey, { ...state, reserved: state.reserved - reservation.maxCost });
    }

    return changes;
  });
}
