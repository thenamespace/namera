import { EthereumAddress } from "@namera-ai/protocol/evm";

// Verified against ENS deployment artifacts and active payment oracles on 2026-11-03:
// https://docs.ens.domains/learn/deployments/
// https://docs.ens.domains/ensv2/eth-registrar/
export const ensNetworks = ["eip155:1", "eip155:11155111"] as const;

export const ensDeployments = {
  "eip155:1": {
    registrar: EthereumAddress.make("0xd6d8369e55c94ae8afa714e6cf7ab5be54d5cc81"),
    tokens: {
      usdc: EthereumAddress.make("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
      dai: EthereumAddress.make("0x6b175474e89094c44da98b954eedeac495271d0f"),
    },
  },
  "eip155:11155111": {
    registrar: EthereumAddress.make("0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3"),
    tokens: {
      usdc: EthereumAddress.make("0x240b0316df57887dbbe58b586508b19e633a14aa"),
      dai: EthereumAddress.make("0xf6fac8a58a0be13b9197f27c41b73162fe32572b"),
    },
  },
} as const;

export const ensPaymentTokens = [
  {
    id: "usdc",
    name: "USD Coin",
    symbol: "USDC",
    logo: "address-catalog/eip155/erc20/usdc.png",
  },
  {
    id: "dai",
    name: "Dai",
    symbol: "DAI",
    logo: "address-catalog/eip155/erc20/dai.png",
  },
] as const;
