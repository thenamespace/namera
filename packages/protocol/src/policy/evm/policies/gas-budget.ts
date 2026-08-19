import { Schema } from "effect";

import { PolicyId } from "#/common/index";
import { SupportedEvmChainId } from "#/evm/chains";

const EvmAmount = Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n));

export const EvmGasBudgetPeriod = Schema.Literals(["hour", "day", "week", "lifetime"]);

export const EvmGasBudget = Schema.Struct({
  chainId: SupportedEvmChainId,
  period: EvmGasBudgetPeriod,
  maxCost: EvmAmount,
});

const GasBudgetFields = {
  type: Schema.Literal("evm.gas-budget"),
  version: Schema.Literal(1),
  budgets: Schema.Array(EvmGasBudget).check(
    Schema.isMinLength(1, { message: "At least one chain gas budget is required" }),
  ),
};

const uniqueChainPeriodBudgets = Schema.makeFilter<{
  readonly budgets: ReadonlyArray<{ readonly chainId: string; readonly period: string }>;
}>((policy) =>
  new Set(policy.budgets.map((budget) => `${budget.chainId}:${budget.period}`)).size ===
  policy.budgets.length
    ? undefined
    : {
        path: ["budgets"],
        issue: "Each chain and period may have only one gas budget",
      },
);

export const CreateEvmGasBudgetPolicy = Schema.Struct(GasBudgetFields)
  .check(uniqueChainPeriodBudgets)
  .annotate({
    identifier: "CreateEvmGasBudgetPolicy",
    description: "Fixed-period and lifetime native gas-cost budgets for an EVM session key",
  });

export const EvmGasBudgetPolicy = Schema.Struct({
  id: PolicyId,
  appliesTo: Schema.Literal("execution"),
  ...GasBudgetFields,
})
  .check(uniqueChainPeriodBudgets)
  .annotate({
    identifier: "EvmGasBudgetPolicy",
    description: "Persisted fixed-period and lifetime native gas-cost budgets for a session key",
  });

export const EvmGasBudgetPolicyState = Schema.Struct({
  version: Schema.Literal(1),
  spent: EvmAmount,
  reserved: EvmAmount,
});

export const EvmGasBudgetPolicyReservation = Schema.Struct({
  version: Schema.Literal(1),
  maxCost: EvmAmount,
});

export type EvmGasBudgetPeriod = typeof EvmGasBudgetPeriod.Type;
export type EvmGasBudget = typeof EvmGasBudget.Type;
export type CreateEvmGasBudgetPolicy = typeof CreateEvmGasBudgetPolicy.Type;
export type EvmGasBudgetPolicy = typeof EvmGasBudgetPolicy.Type;
export type EvmGasBudgetPolicyState = typeof EvmGasBudgetPolicyState.Type;
export type EvmGasBudgetPolicyReservation = typeof EvmGasBudgetPolicyReservation.Type;
