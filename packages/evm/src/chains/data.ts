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
  readonly alchemyChain: string;
}

export const chains = {
  "arb-mainnet": { chain: arbitrum, alchemyChain: "arb-mainnet" },
  "arb-sepolia": { chain: arbitrumSepolia, alchemyChain: "arb-sepolia" },
  "arc-testnet": { chain: arcTestnet, alchemyChain: "arc-testnet" },
  "avax-fuji": { chain: avalancheFuji, alchemyChain: "avax-fuji" },
  "avax-mainnet": { chain: avalanche, alchemyChain: "avax-mainnet" },
  "base-mainnet": { chain: base, alchemyChain: "base-mainnet" },
  "base-sepolia": { chain: baseSepolia, alchemyChain: "base-sepolia" },
  "celo-mainnet": { chain: celo, alchemyChain: "celo-mainnet" },
  "eth-mainnet": { chain: mainnet, alchemyChain: "eth-mainnet" },
  "eth-sepolia": { chain: sepolia, alchemyChain: "eth-sepolia" },
  "hyperevm-mainnet": { chain: hyperEvm, alchemyChain: "hyperliquid-mainnet" },
  "megaeth-mainnet": { chain: megaeth, alchemyChain: "megaeth-mainnet" },
  "megaeth-testnet": { chain: megaethTestnet, alchemyChain: "megaeth-testnet" },
  "monad-mainnet": { chain: monad, alchemyChain: "monad-mainnet" },
  "monad-testnet": { chain: monadTestnet, alchemyChain: "monad-testnet" },
  "opt-mainnet": { chain: optimism, alchemyChain: "opt-mainnet" },
  "opt-sepolia": { chain: optimismSepolia, alchemyChain: "opt-sepolia" },
  "polygon-amoy": { chain: polygonAmoy, alchemyChain: "polygon-amoy" },
  "polygon-mainnet": { chain: polygon, alchemyChain: "polygon-mainnet" },
  "scroll-mainnet": { chain: scroll, alchemyChain: "scroll-mainnet" },
  "scroll-sepolia": { chain: scrollSepolia, alchemyChain: "scroll-sepolia" },
  "tempo-mainnet": { chain: tempo, alchemyChain: "tempo-mainnet" },
  "tempo-moderato": { chain: tempoModerato, alchemyChain: "tempo-moderato" },
  "unichain-mainnet": { chain: unichain, alchemyChain: "unichain-mainnet" },
  "unichain-sepolia": { chain: unichainSepolia, alchemyChain: "unichain-sepolia" },
} as const satisfies Record<string, ChainData>;

export type SupportedChain = keyof typeof chains;
export type AlchemyChain = (typeof chains)[SupportedChain]["alchemyChain"];
