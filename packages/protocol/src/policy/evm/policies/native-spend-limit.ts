import { Schema } from "effect";

import { PolicyId } from "#/common/index";
import { SupportedEvmChainId } from "#/evm/chains";

const EvmAmount = Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n));

export const EvmNativeSpendLimit = Schema.Struct({
  chainId: SupportedEvmChainId,
  maxAmount: EvmAmount,
});

const NativeSpendLimitFields = {
  type: Schema.Literal("evm.native-spend-limit"),
  version: Schema.Literal(1),
  limits: Schema.Array(EvmNativeSpendLimit).check(
    Schema.isMinLength(1, { message: "At least one chain limit is required" }),
  ),
};

const uniqueChainLimits = Schema.makeFilter<{
  readonly limits: ReadonlyArray<{ readonly chainId: string }>;
}>((policy) =>
  new Set(policy.limits.map((limit) => limit.chainId)).size === policy.limits.length
    ? undefined
    : { path: ["limits"], issue: "Each chain may have only one native spend limit" },
);

export const CreateEvmNativeSpendLimitPolicy = Schema.Struct(NativeSpendLimitFields)
  .check(uniqueChainLimits)
  .annotate({
    identifier: "CreateEvmNativeSpendLimitPolicy",
    description: "A cumulative native-value spend limit for an EVM session key",
  });

export const EvmNativeSpendLimitPolicy = Schema.Struct({
  id: PolicyId,
  ...NativeSpendLimitFields,
})
  .check(uniqueChainLimits)
  .annotate({
    identifier: "EvmNativeSpendLimitPolicy",
    description: "A persisted cumulative native-value spend limit for an EVM session key",
  });

export const EvmNativeSpendLimitPolicyState = Schema.Struct({
  version: Schema.Literal(1),
  spent: EvmAmount,
  reserved: EvmAmount,
});

export const EvmNativeSpendLimitPolicyReservation = Schema.Struct({
  version: Schema.Literal(1),
  amount: EvmAmount,
});

export type EvmNativeSpendLimit = typeof EvmNativeSpendLimit.Type;
export type CreateEvmNativeSpendLimitPolicy = typeof CreateEvmNativeSpendLimitPolicy.Type;
export type EvmNativeSpendLimitPolicy = typeof EvmNativeSpendLimitPolicy.Type;
export type EvmNativeSpendLimitPolicyState = typeof EvmNativeSpendLimitPolicyState.Type;
export type EvmNativeSpendLimitPolicyReservation = typeof EvmNativeSpendLimitPolicyReservation.Type;
