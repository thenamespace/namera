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

export type SupportedChain =
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
  | "hyperevm-mainnet"
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

export type AlchemyChain = Exclude<SupportedChain, "hyperevm-mainnet"> | "hyperliquid-mainnet";

export interface ChainData {
  readonly chain: Chain;
  readonly chainId: `eip155:${number}`;
  readonly namespace: "eip155";
  readonly alchemyChain: AlchemyChain;
}

const chainData = <const TChain extends Chain, const TAlchemyChain extends AlchemyChain>(
  chain: TChain,
  alchemyChain: TAlchemyChain,
): ChainData => ({
  chain,
  chainId: `eip155:${chain.id}` as const,
  namespace: "eip155" as const,
  alchemyChain,
});

export const chains: Readonly<Record<SupportedChain, ChainData>> = {
  "arb-mainnet": chainData(arbitrum, "arb-mainnet"),
  "arb-sepolia": chainData(arbitrumSepolia, "arb-sepolia"),
  "arc-testnet": chainData(arcTestnet, "arc-testnet"),
  "avax-fuji": chainData(avalancheFuji, "avax-fuji"),
  "avax-mainnet": chainData(avalanche, "avax-mainnet"),
  "base-mainnet": chainData(base, "base-mainnet"),
  "base-sepolia": chainData(baseSepolia, "base-sepolia"),
  "celo-mainnet": chainData(celo, "celo-mainnet"),
  "eth-mainnet": chainData(mainnet, "eth-mainnet"),
  "eth-sepolia": chainData(sepolia, "eth-sepolia"),
  "hyperevm-mainnet": chainData(hyperEvm, "hyperliquid-mainnet"),
  "megaeth-mainnet": chainData(megaeth, "megaeth-mainnet"),
  "megaeth-testnet": chainData(megaethTestnet, "megaeth-testnet"),
  "monad-mainnet": chainData(monad, "monad-mainnet"),
  "monad-testnet": chainData(monadTestnet, "monad-testnet"),
  "opt-mainnet": chainData(optimism, "opt-mainnet"),
  "opt-sepolia": chainData(optimismSepolia, "opt-sepolia"),
  "polygon-amoy": chainData(polygonAmoy, "polygon-amoy"),
  "polygon-mainnet": chainData(polygon, "polygon-mainnet"),
  "scroll-mainnet": chainData(scroll, "scroll-mainnet"),
  "scroll-sepolia": chainData(scrollSepolia, "scroll-sepolia"),
  "tempo-mainnet": chainData(tempo, "tempo-mainnet"),
  "tempo-moderato": chainData(tempoModerato, "tempo-moderato"),
  "unichain-mainnet": chainData(unichain, "unichain-mainnet"),
  "unichain-sepolia": chainData(unichainSepolia, "unichain-sepolia"),
};

export type SupportedChainId = ChainData["chainId"];
export type ChainNamespace = ChainData["namespace"];
