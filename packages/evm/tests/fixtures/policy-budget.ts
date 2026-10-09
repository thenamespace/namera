import { Schema } from "effect";

import type {
  EvmChainAllowlistPolicy,
  EvmGasBudgetPolicy,
  EvmNativeSpendLimitPolicy,
} from "@namera-ai/protocol";
import { PolicyId, SupportedEvmChainId } from "@namera-ai/protocol";

export const chainId = Schema.decodeSync(SupportedEvmChainId)("eip155:1");
export const policyId = Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000001");
export const timeWindowPolicyId = Schema.decodeSync(PolicyId)(
  "01900000-0000-7000-8000-000000000002",
);
export const chainAllowlistPolicyId = Schema.decodeSync(PolicyId)(
  "01900000-0000-7000-8000-000000000003",
);
export const gasBudgetPolicyId = Schema.decodeSync(PolicyId)(
  "01900000-0000-7000-8000-000000000004",
);
export const policy = {
  id: policyId,
  type: "evm.native-spend-limit",
  version: 1,
  appliesTo: "execution",
  limits: [{ chainId, period: "lifetime", maxAmount: 10n }],
} satisfies EvmNativeSpendLimitPolicy;
export const lifetimeStateKey = `${chainId}:lifetime`;
export const chainAllowlistPolicy = {
  id: chainAllowlistPolicyId,
  type: "evm.chain-allowlist",
  version: 1,
  appliesTo: "both",
  chainIds: [chainId],
} satisfies EvmChainAllowlistPolicy;
export const gasBudgetPolicy = {
  id: gasBudgetPolicyId,
  type: "evm.gas-budget",
  version: 1,
  appliesTo: "execution",
  budgets: [
    { chainId, period: "day", maxCost: 20n },
    { chainId, period: "lifetime", maxCost: 100n },
  ],
} satisfies EvmGasBudgetPolicy;
