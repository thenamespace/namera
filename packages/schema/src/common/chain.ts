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
  tempo,
  gnosis,
  gnosisChiado,
  linea,
  lineaSepolia,
  megaeth,
  megaethTestnet,
} from "viem/chains";

// Available Chains to add in the future
// - Berachain
// - Blast
// - BOB
// - Mantle

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
  "tempo-mainnet": {
    ...tempo,
    key: "tempo-mainnet",
  },
  "gnosis-mainnet": {
    ...gnosis,
    key: "gnosis-mainnet",
  },
  "linea-mainnet": {
    ...linea,
    key: "linea-mainnet",
  },
  "megaeth-mainnet": {
    ...megaeth,
    key: "megaeth-mainnet",
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
  "scroll-sepolia": {
    ...scrollSepolia,
    key: "scroll-sepolia",
  },
  "arc-testnet": {
    ...arcTestnet,
    key: "arc-testnet",
  },
  "gnosis-chiado": {
    ...gnosisChiado,
    key: "gnosis-chiado",
  },
  "linea-sepolia": {
    ...lineaSepolia,
    key: "linea-sepolia",
  },
  "megaeth-testnet": {
    ...megaethTestnet,
    key: "megaeth-testnet",
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

export const supportedChainsArray = Object.values(supportedChains);

export const getChain = (chain: SupportedChain): ChainWithMetadata => {
  return supportedChains[chain];
};

export const getChainFromId = (
  chainId: number,
): ChainWithMetadata | undefined => {
  return Object.values(supportedChains).find((c) => c.id === chainId);
};
