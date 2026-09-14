import type { ComponentProps } from "react";

import { chains } from "@namera-ai/evm/chains";
import type { EvmGasBudgetPeriod, EvmNativeSpendLimitPeriod } from "@namera-ai/protocol";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import type { HugeiconsIcon } from "@namera-ai/ui/icons";

import { definition as accountFunctions } from "./account-functions/definition";
import { definition as chainAllowlistDefinition } from "./chain-allowlist/definition";
import { definition as contractAccess } from "./contract-access/definition";
import { definition as tokenSpend } from "./erc20-token-transfer/definition";
import { definition as wildcardFunctions } from "./functions-on-all-contracts/definition";
import { definition as contractFunctions } from "./functions-on-contract/definition";
import { definition as gasBudgetDefinition } from "./gas-budget/definition";
import { definition as nativeSpendLimitDefinition } from "./native-spend-limit/definition";
import type { OnchainPermissionType } from "./onchain/catalog";
import { definition as signatureDefinition } from "./signature/definition";
import { definition as timeWindowDefinition } from "./time-window/definition";
import type { EvmPolicyType } from "./types";

export const evmChainOptions = Object.values(chains)
  .map((data) => ({
    id: data.chainId,
    chain: data.name,
    name: data.chain.name,
    nativeCurrency: data.chain.nativeCurrency,
    testnet: data.chain.testnet ?? false,
    operationsEnabled: data.operationsEnabled,
  }))
  .toSorted((left, right) => {
    if (left.testnet !== right.testnet) return left.testnet ? 1 : -1;
    return left.name.localeCompare(right.name);
  });

export const evmChainById = new Map<SupportedEvmChainId, (typeof evmChainOptions)[number]>(
  evmChainOptions.map((chain) => [chain.id, chain]),
);

export const nativeSpendPeriodOptions = [
  { id: "operation", label: "Per operation", description: "Applies to each execution" },
  { id: "hour", label: "Hourly", description: "Resets at the start of each UTC hour" },
  { id: "day", label: "Daily", description: "Resets every day at 00:00 UTC" },
  { id: "week", label: "Weekly", description: "Resets every Monday at 00:00 UTC" },
  { id: "month", label: "Monthly", description: "Resets on the first day of each UTC month" },
  { id: "lifetime", label: "Lifetime", description: "Never resets" },
] as const satisfies ReadonlyArray<{
  readonly id: EvmNativeSpendLimitPeriod;
  readonly label: string;
  readonly description: string;
}>;

export const nativeSpendPeriodById = new Map<
  EvmNativeSpendLimitPeriod,
  (typeof nativeSpendPeriodOptions)[number]
>(nativeSpendPeriodOptions.map((period) => [period.id, period]));

export const gasBudgetPeriodOptions = [
  { id: "hour", label: "Hourly", description: "Resets at the start of each UTC hour" },
  { id: "day", label: "Daily", description: "Resets every day at 00:00 UTC" },
  { id: "week", label: "Weekly", description: "Resets every Monday at 00:00 UTC" },
  { id: "lifetime", label: "Lifetime", description: "Never resets" },
] as const satisfies ReadonlyArray<{
  readonly id: EvmGasBudgetPeriod;
  readonly label: string;
  readonly description: string;
}>;

export const gasBudgetPeriodById = new Map<
  EvmGasBudgetPeriod,
  (typeof gasBudgetPeriodOptions)[number]
>(gasBudgetPeriodOptions.map((period) => [period.id, period]));

type PolicyDefinition = {
  readonly onchain?: OnchainPermissionType | "time-window" | "signature";
  readonly type: EvmPolicyType;
  readonly name: string;
  readonly description: string;
  readonly cardinality: "singleton" | "repeatable";
  readonly icon: ComponentProps<typeof HugeiconsIcon>["icon"];
};

export const evmPolicyDefinitions = {
  "evm.contract-access": contractAccess,
  "evm.functions-on-contract": contractFunctions,
  "evm.functions-on-all-contracts": wildcardFunctions,
  "evm.account-functions": accountFunctions,
  "evm.erc20-token-transfer": tokenSpend,
  "evm.chain-allowlist": chainAllowlistDefinition,
  "evm.gas-budget": gasBudgetDefinition,
  "evm.time-window": timeWindowDefinition,
  "evm.native-spend-limit": nativeSpendLimitDefinition,
  "evm.signature": signatureDefinition,
} satisfies Record<EvmPolicyType, PolicyDefinition>;

export const evmPolicyCatalog = Object.values(evmPolicyDefinitions);

export const evmPolicyFormIds = {
  "evm.contract-access": "evm-contract-access-policy-form",
  "evm.functions-on-contract": "evm-contract-functions-policy-form",
  "evm.functions-on-all-contracts": "evm-wildcard-functions-policy-form",
  "evm.account-functions": "evm-account-functions-policy-form",
  "evm.erc20-token-transfer": "evm-token-spend-policy-form",
  "evm.chain-allowlist": "evm-chain-allowlist-policy-form",
  "evm.gas-budget": "evm-gas-budget-policy-form",
  "evm.time-window": "evm-time-window-policy-form",
  "evm.native-spend-limit": "evm-native-spend-limit-policy-form",
  "evm.signature": "evm-signature-policy-form",
} satisfies Record<EvmPolicyType, string>;
