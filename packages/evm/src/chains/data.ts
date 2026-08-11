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

interface ChainData {
  readonly chain: Chain;
  readonly chainId: `eip155:${number}`;
  readonly namespace: "eip155";
  readonly alchemyChain: string;
}

const chainData = <const TChain extends Chain, const TAlchemyChain extends string>(
  chain: TChain,
  alchemyChain: TAlchemyChain,
) => ({
  chain,
  chainId: `eip155:${chain.id}` as const,
  namespace: "eip155" as const,
  alchemyChain,
});

export const chains = {
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
} as const satisfies Record<string, ChainData>;

export type SupportedChain = keyof typeof chains;
export type SupportedChainId = (typeof chains)[SupportedChain]["chainId"];
export type ChainNamespace = (typeof chains)[SupportedChain]["namespace"];
export type AlchemyChain = (typeof chains)[SupportedChain]["alchemyChain"];
