import { Schema } from "effect";

import {
  type EvmChainName,
  type SupportedEvmChain,
  SupportedEvmChainId,
} from "@namera-ai/protocol/evm";
import type { Chain } from "viem";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  optimism,
  optimismSepolia,
  sepolia,
} from "viem/chains";

export type { EvmChainName, SupportedEvmChain, SupportedEvmChainId } from "@namera-ai/protocol/evm";

export type AlchemyChain =
  | "arb-mainnet"
  | "arb-sepolia"
  | "base-mainnet"
  | "base-sepolia"
  | "eth-mainnet"
  | "eth-sepolia"
  | "opt-mainnet"
  | "opt-sepolia";

export interface ChainData {
  readonly chain: Chain;
  readonly chainId: SupportedEvmChainId;
  readonly name: EvmChainName;
  readonly namespace: "eip155";
  readonly alchemyChain: AlchemyChain;
  readonly environment: "mainnet" | "testnet";
  /** Pause new preparations/signatures without removing historical chain identity. */
  readonly operationsEnabled: boolean;
}

const chainData = <const TChain extends Chain, const TAlchemyChain extends AlchemyChain>(
  chain: TChain,
  name: EvmChainName,
  alchemyChain: TAlchemyChain,
  operationsEnabled: boolean,
): ChainData => ({
  chain,
  chainId: Schema.decodeUnknownSync(SupportedEvmChainId)(`eip155:${chain.id}`),
  name,
  namespace: "eip155",
  alchemyChain,
  environment: chain.testnet === true ? "testnet" : "mainnet",
  operationsEnabled,
});

export const chains: Readonly<Record<SupportedEvmChain, ChainData>> = {
  "arbitrum-mainnet": chainData(arbitrum, "arbitrum", "arb-mainnet", true),
  "arbitrum-sepolia": chainData(arbitrumSepolia, "arbitrum", "arb-sepolia", true),
  "base-mainnet": chainData(base, "base", "base-mainnet", true),
  "base-sepolia": chainData(baseSepolia, "base", "base-sepolia", true),
  "ethereum-mainnet": chainData(mainnet, "ethereum", "eth-mainnet", true),
  "ethereum-sepolia": chainData(sepolia, "ethereum", "eth-sepolia", true),
  "optimism-mainnet": chainData(optimism, "optimism", "opt-mainnet", true),
  "optimism-sepolia": chainData(optimismSepolia, "optimism", "opt-sepolia", true),
};

export type SupportedChainId = SupportedEvmChainId;
export type ChainNamespace = ChainData["namespace"];
