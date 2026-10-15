import type { ComponentProps } from "react";

import { chains } from "@namera-ai/evm/chains";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import type { HugeiconsIcon } from "@namera-ai/ui/icons";

import { definition as chainAllowlistDefinition } from "./chain-allowlist/definition";
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

type PolicyDefinition = {
  readonly onchain?: OnchainPermissionType | "time-window" | "signature";
  readonly type: EvmPolicyType;
  readonly name: string;
  readonly description: string;
  readonly cardinality: "singleton" | "repeatable";
  readonly icon: ComponentProps<typeof HugeiconsIcon>["icon"];
};

export const evmPolicyDefinitions = {
  "evm.chain-allowlist": chainAllowlistDefinition,
  "evm.time-window": timeWindowDefinition,
  "evm.signature": signatureDefinition,
} satisfies Record<EvmPolicyType, PolicyDefinition>;

export const evmPolicyCatalog = Object.values(evmPolicyDefinitions);

export const evmPolicyFormIds = {
  "evm.chain-allowlist": "evm-chain-allowlist-policy-form",
  "evm.time-window": "evm-time-window-policy-form",
  "evm.signature": "evm-signature-policy-form",
} satisfies Record<EvmPolicyType, string>;
