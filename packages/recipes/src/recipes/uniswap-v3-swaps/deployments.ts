import { EthereumAddress } from "@namera-ai/protocol/evm";

// SwapRouter02 deployments reviewed 2026-11-03 against Uniswap's official lists:
// https://developers.uniswap.org/docs/protocols/v3/deployments
export const uniswapV3Networks = [
  "eip155:1",
  "eip155:10",
  "eip155:8453",
  "eip155:42161",
  "eip155:11155111",
  "eip155:11155420",
  "eip155:84532",
  "eip155:421614",
] as const;

export const uniswapV3Routers = {
  "eip155:1": EthereumAddress.make("0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"),
  "eip155:10": EthereumAddress.make("0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"),
  "eip155:8453": EthereumAddress.make("0x2626664c2603336e57b271c5c0b26f421741e481"),
  "eip155:42161": EthereumAddress.make("0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"),
  "eip155:11155111": EthereumAddress.make("0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e"),
  "eip155:11155420": EthereumAddress.make("0x94cc0aac535ccdb3c01d6787d6413c739ae12bc4"),
  "eip155:84532": EthereumAddress.make("0x94cc0aac535ccdb3c01d6787d6413c739ae12bc4"),
  "eip155:421614": EthereumAddress.make("0x101f443b4d1b059569d643917553c771e1b9663e"),
} as const;
