import { Schema } from "effect";
import {
  arbitrum,
  arbitrumSepolia,
  arcTestnet,
  avalanche,
  avalancheFuji,
  base,
  baseSepolia,
  type Chain,
  celo,
  celoSepolia,
  mainnet,
  monad,
  monadTestnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  scroll,
  scrollSepolia,
  sepolia,
  tempoModerato,
  unichain,
  unichainSepolia,
  zora,
  zoraSepolia,
} from "viem/chains";

export type ChainWithMetadata = Chain & {
  key: string;
};

const supportedMainnetChains = {
  "eth-mainnet": {
    ...mainnet,
    key: "eth-mainnet",
  },
  "opt-mainnet": {
    ...optimism,
    key: "opt-mainnet",
  },
  "polygon-mainnet": {
    ...polygon,
    key: "polygon-mainnet",
  },
  "arb-mainnet": {
    ...arbitrum,
    key: "arb-mainnet",
  },
  "zora-mainnet": {
    ...zora,
    key: "zora-mainnet",
  },
  "base-mainnet": {
    ...base,
    key: "base-mainnet",
  },
  "avax-mainnet": {
    ...avalanche,
    key: "avax-mainnet",
  },
  "unichain-mainnet": {
    ...unichain,
    key: "unichain-mainnet",
  },
  "celo-mainnet": {
    ...celo,
    key: "celo-mainnet",
  },
  "scroll-mainnet": {
    ...scroll,
    key: "scroll-mainnet",
  },
  "monad-mainnet": {
    ...monad,
    key: "monad-mainnet",
  },
} as const;

const supportedTestnetChains = {
  "eth-sepolia": {
    ...sepolia,
    key: "eth-sepolia",
  },
  "opt-sepolia": {
    ...optimismSepolia,
    key: "opt-sepolia",
  },
  "polygon-amoy": {
    ...polygonAmoy,
    key: "polygon-amoy",
  },
  "arb-sepolia": {
    ...arbitrumSepolia,
    key: "arb-sepolia",
  },
  "zora-sepolia": {
    ...zoraSepolia,
    key: "zora-sepolia",
  },
  "base-sepolia": {
    ...baseSepolia,
    key: "base-sepolia",
  },
  "tempo-moderato": {
    ...tempoModerato,
    key: "tempo-moderato",
  },
  "avax-fuji": {
    ...avalancheFuji,
    key: "avax-fuji",
  },
  "unichain-sepolia": {
    ...unichainSepolia,
    key: "unichain-sepolia",
  },
  "monad-testnet": {
    ...monadTestnet,
    key: "monad-testnet",
  },
  "celo-sepolia": {
    ...celoSepolia,
    key: "celo-sepolia",
  },
  "scroll-sepolia": {
    ...scrollSepolia,
    key: "scroll-sepolia",
  },
  "arc-testnet": {
    ...arcTestnet,
    key: "arc-testnet",
  },
} as const;

type SupportedTestnetChain = keyof typeof supportedMainnetChains;
type SupportedMainnetChain = keyof typeof supportedTestnetChains;

export const SupportedChain = Schema.Literals([
  ...(Object.keys(supportedMainnetChains) as SupportedMainnetChain[]),
  ...(Object.keys(supportedTestnetChains) as SupportedTestnetChain[]),
]);

export type SupportedChain = typeof SupportedChain.Type;

export const supportedChains = {
  ...supportedMainnetChains,
  ...supportedTestnetChains,
} as Record<SupportedChain, ChainWithMetadata>;

export const getChain = (chain: SupportedChain): ChainWithMetadata => {
  return supportedChains[chain];
};

export const getChainFromId = (
  chainId: number,
): ChainWithMetadata | undefined => {
  return Object.values(supportedChains).find((c) => c.id === chainId);
};
