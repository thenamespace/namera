import type { ComponentProps } from "react";

import { chains } from "@namera-ai/evm";
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
    description: "Set a lifetime native-token allowance for each network.",
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
