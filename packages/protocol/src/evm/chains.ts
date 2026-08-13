import { Schema } from "effect";

export const EvmChainName = Schema.Literals([
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "celo",
  "ethereum",
  "hyper-evm",
  "megaeth",
  "monad",
  "optimism",
  "polygon",
  "scroll",
  "tempo",
  "unichain",
]).annotate({
  identifier: "EvmChainName",
  description: "Stable EVM chain name used for presentation and chain grouping",
});

export const SupportedEvmChain = Schema.Literals([
  "arbitrum-mainnet",
  "arbitrum-sepolia",
  "arc-testnet",
  "avalanche-fuji",
  "avalanche-mainnet",
  "base-mainnet",
  "base-sepolia",
  "celo-mainnet",
  "ethereum-mainnet",
  "ethereum-sepolia",
  "hyper-evm-mainnet",
  "megaeth-mainnet",
  "megaeth-testnet",
  "monad-mainnet",
  "monad-testnet",
  "optimism-mainnet",
  "optimism-sepolia",
  "polygon-amoy",
  "polygon-mainnet",
  "scroll-mainnet",
  "scroll-sepolia",
  "tempo-mainnet",
  "tempo-moderato",
  "unichain-mainnet",
  "unichain-sepolia",
]).annotate({
  identifier: "SupportedEvmChain",
  description: "An EVM network supported by Namera",
});

export const SupportedEvmChainId = Schema.Literals([
  "eip155:1",
  "eip155:10",
  "eip155:130",
  "eip155:137",
  "eip155:143",
  "eip155:999",
  "eip155:1301",
  "eip155:4217",
  "eip155:4326",
  "eip155:6343",
  "eip155:8453",
  "eip155:10143",
  "eip155:42161",
  "eip155:42220",
  "eip155:42431",
  "eip155:43113",
  "eip155:43114",
  "eip155:80002",
  "eip155:84532",
  "eip155:421614",
  "eip155:5042002",
  "eip155:534351",
  "eip155:534352",
  "eip155:11155111",
  "eip155:11155420",
]).annotate({
  identifier: "SupportedEvmChainId",
  description: "A CAIP-2 identifier for an EVM network supported by Namera",
});

export type EvmChainName = typeof EvmChainName.Type;
export type SupportedEvmChain = typeof SupportedEvmChain.Type;
export type SupportedEvmChainId = typeof SupportedEvmChainId.Type;
