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
  arcTestnet,
  avalanche,
  avalancheFuji,
  base,
  baseSepolia,
  celo,
  hyperEvm,
  mainnet,
  megaeth,
  megaethTestnet,
  monad,
  monadTestnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  scroll,
  scrollSepolia,
  sepolia,
  tempo,
  tempoModerato,
  unichain,
  unichainSepolia,
} from "viem/chains";

export type { EvmChainName, SupportedEvmChain, SupportedEvmChainId } from "@namera-ai/protocol/evm";

export type AlchemyChain =
  | "arb-mainnet"
  | "arb-sepolia"
  | "arc-testnet"
  | "avax-fuji"
  | "avax-mainnet"
  | "base-mainnet"
  | "base-sepolia"
  | "celo-mainnet"
  | "eth-mainnet"
  | "eth-sepolia"
  | "hyperliquid-mainnet"
  | "megaeth-mainnet"
  | "megaeth-testnet"
  | "monad-mainnet"
  | "monad-testnet"
  | "opt-mainnet"
  | "opt-sepolia"
  | "polygon-amoy"
  | "polygon-mainnet"
  | "scroll-mainnet"
  | "scroll-sepolia"
  | "tempo-mainnet"
  | "tempo-moderato"
  | "unichain-mainnet"
  | "unichain-sepolia";

export interface ChainData {
  readonly chain: Chain;
  readonly chainId: SupportedEvmChainId;
  readonly name: EvmChainName;
  readonly namespace: "eip155";
  readonly alchemyChain: AlchemyChain;
}

const chainData = <const TChain extends Chain, const TAlchemyChain extends AlchemyChain>(
  chain: TChain,
  name: EvmChainName,
  alchemyChain: TAlchemyChain,
): ChainData => ({
  chain,
  chainId: Schema.decodeUnknownSync(SupportedEvmChainId)(`eip155:${chain.id}`),
  name,
  namespace: "eip155",
  alchemyChain,
});

export const chains: Readonly<Record<SupportedEvmChain, ChainData>> = {
  "arbitrum-mainnet": chainData(arbitrum, "arbitrum", "arb-mainnet"),
  "arbitrum-sepolia": chainData(arbitrumSepolia, "arbitrum", "arb-sepolia"),
  "arc-testnet": chainData(arcTestnet, "arc", "arc-testnet"),
  "avalanche-fuji": chainData(avalancheFuji, "avalanche", "avax-fuji"),
  "avalanche-mainnet": chainData(avalanche, "avalanche", "avax-mainnet"),
  "base-mainnet": chainData(base, "base", "base-mainnet"),
  "base-sepolia": chainData(baseSepolia, "base", "base-sepolia"),
  "celo-mainnet": chainData(celo, "celo", "celo-mainnet"),
  "ethereum-mainnet": chainData(mainnet, "ethereum", "eth-mainnet"),
  "ethereum-sepolia": chainData(sepolia, "ethereum", "eth-sepolia"),
  "hyper-evm-mainnet": chainData(hyperEvm, "hyper-evm", "hyperliquid-mainnet"),
  "megaeth-mainnet": chainData(megaeth, "megaeth", "megaeth-mainnet"),
  "megaeth-testnet": chainData(megaethTestnet, "megaeth", "megaeth-testnet"),
  "monad-mainnet": chainData(monad, "monad", "monad-mainnet"),
  "monad-testnet": chainData(monadTestnet, "monad", "monad-testnet"),
  "optimism-mainnet": chainData(optimism, "optimism", "opt-mainnet"),
  "optimism-sepolia": chainData(optimismSepolia, "optimism", "opt-sepolia"),
  "polygon-amoy": chainData(polygonAmoy, "polygon", "polygon-amoy"),
  "polygon-mainnet": chainData(polygon, "polygon", "polygon-mainnet"),
  "scroll-mainnet": chainData(scroll, "scroll", "scroll-mainnet"),
  "scroll-sepolia": chainData(scrollSepolia, "scroll", "scroll-sepolia"),
  "tempo-mainnet": chainData(tempo, "tempo", "tempo-mainnet"),
  "tempo-moderato": chainData(tempoModerato, "tempo", "tempo-moderato"),
  "unichain-mainnet": chainData(unichain, "unichain", "unichain-mainnet"),
  "unichain-sepolia": chainData(unichainSepolia, "unichain", "unichain-sepolia"),
};

export type SupportedChainId = SupportedEvmChainId;
export type ChainNamespace = ChainData["namespace"];
