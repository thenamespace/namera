import type { ComponentProps } from "react";

import { chains } from "@namera-ai/evm";
import type { EvmNativeSpendLimitPeriod } from "@namera-ai/protocol";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import {
  CalendarClockIcon,
  Coins01Icon,
  type HugeiconsIcon,
  SignatureIcon,
} from "@namera-ai/ui/icons";

import type { EvmPolicyType } from "./types";

export const evmChainOptions = Object.values(chains)
  .map((data) => ({
    id: data.chainId,
    chain: data.name,
    name: data.chain.name,
    nativeCurrency: data.chain.nativeCurrency,
    testnet: data.chain.testnet ?? false,
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

type PolicyDefinition = {
  readonly type: EvmPolicyType;
  readonly name: string;
  readonly description: string;
  readonly cardinality: "singleton" | "repeatable";
  readonly icon: ComponentProps<typeof HugeiconsIcon>["icon"];
};

export const evmPolicyDefinitions = {
  "evm.time-window": {
    type: "evm.time-window",
    name: "Time window",
    description: "Choose when this session key starts and expires.",
    cardinality: "singleton",
    icon: CalendarClockIcon,
  },
  "evm.native-spend-limit": {
    type: "evm.native-spend-limit",
    name: "Native spend",
    description: "Limit native-token spending per operation or reset period.",
    cardinality: "singleton",
    icon: Coins01Icon,
  },
  "evm.signature": {
    type: "evm.signature",
    name: "Signatures",
    description: "Allow message signing, typed-data signing, or both.",
    cardinality: "singleton",
    icon: SignatureIcon,
  },
} satisfies Record<EvmPolicyType, PolicyDefinition>;

export const evmPolicyCatalog = Object.values(evmPolicyDefinitions);

export const evmPolicyFormIds = {
  "evm.time-window": "evm-time-window-policy-form",
  "evm.native-spend-limit": "evm-native-spend-limit-policy-form",
  "evm.signature": "evm-signature-policy-form",
} satisfies Record<EvmPolicyType, string>;
