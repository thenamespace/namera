import { Schema } from "effect";

export const EvmChainName = Schema.Literals(["arbitrum", "base", "ethereum", "optimism"]).annotate({
  identifier: "EvmChainName",
  description: "Stable EVM chain name used for presentation and chain grouping",
});

export const SupportedEvmChain = Schema.Literals([
  "arbitrum-mainnet",
  "arbitrum-sepolia",
  "base-mainnet",
  "base-sepolia",
  "ethereum-mainnet",
  "ethereum-sepolia",
  "optimism-mainnet",
  "optimism-sepolia",
]).annotate({
  identifier: "SupportedEvmChain",
  description: "An EVM network supported by Namera",
});

export const SupportedEvmChainId = Schema.Literals([
  "eip155:1",
  "eip155:10",
  "eip155:8453",
  "eip155:42161",
  "eip155:84532",
  "eip155:421614",
  "eip155:11155111",
  "eip155:11155420",
]).annotate({
  identifier: "SupportedEvmChainId",
  description: "A CAIP-2 identifier for an EVM network supported by Namera",
});

export type EvmChainName = typeof EvmChainName.Type;
export type SupportedEvmChain = typeof SupportedEvmChain.Type;
export type SupportedEvmChainId = typeof SupportedEvmChainId.Type;
