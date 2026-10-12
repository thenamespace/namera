import { EthereumAddress, type SupportedEvmChainId } from "@namera-ai/protocol/evm";

// Circle-issued USDC, not bridged USDC.e. Reviewed 2026-10-13:
// https://developers.circle.com/stablecoins/usdc-contract-addresses
export const usdcDeployments = {
  "eip155:1": EthereumAddress.make("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
  "eip155:10": EthereumAddress.make("0x0b2c639c533813f4aa9d7837caf62653d097ff85"),
  "eip155:8453": EthereumAddress.make("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"),
  "eip155:42161": EthereumAddress.make("0xaf88d065e77c8cc2239327c5edb3a432268e5831"),
  "eip155:84532": EthereumAddress.make("0x036cbd53842c5426634e7929541ec2318f3dcf7e"),
  "eip155:421614": EthereumAddress.make("0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d"),
  "eip155:11155111": EthereumAddress.make("0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"),
  "eip155:11155420": EthereumAddress.make("0x5fd84259d66cd46123540766be93dfe6d43130d7"),
} satisfies Record<SupportedEvmChainId, EthereumAddress>;

export const usdcNetworks = Object.keys(usdcDeployments) as (keyof typeof usdcDeployments)[];
