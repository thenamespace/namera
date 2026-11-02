import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { Hex } from "@namera-ai/protocol/evm";

import type { Template } from "#/definition";
import { templateValidUntil } from "#/inputs/expiry";
import { uniswapV3Networks, uniswapV3Routers } from "#/uniswap/deployments";
import { UniswapSessionInput } from "#/uniswap/input";

// SwapRouter02's IV3SwapRouter tuples omit the original SwapRouter's deadline.
// exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))
// exactInput((bytes,address,uint256,uint256))
const swapSelectors = [Hex.make("0x04e45aaf"), Hex.make("0xb858183f")];

export const uniswapV3SwapsTemplate = {
  id: "uniswap-v3-swaps",
  version: 1,
  display: {
    name: "Uniswap v3 Swaps Template",
    description: "Let an agent swap previously approved tokens through Uniswap v3.",
    logo: "templates/uniswap-v3-swaps/logo.webp",
    banner: "templates/uniswap-v3-swaps/header.webp",
    tags: ["Uniswap v3", "Swaps", "DeFi"],
  },
  inputSchema: UniswapSessionInput,
  metadata: { name: "Uniswap swaps", logo: { type: "emoji", value: "🦄" } },
  defaults: { networks: [], expiresAt: "" },
  fields: [
    { name: "networks", kind: "networks", label: "Networks", chainIds: uniswapV3Networks },
    { name: "expiresAt", kind: "expiry", label: "Expires on" },
  ],
  approvalNote:
    "Before swapping, approve the input token to the Uniswap router on the selected network.",
  build(input, { now }) {
    const values = Schema.decodeUnknownSync(UniswapSessionInput)(input);
    const validUntil = templateValidUntil(values.expiresAt, now);

    return {
      onchain: {
        installations: values.networks.map((chainId) =>
          CreateEvmSessionInstallation.make({
            chainId,
            validAfter: now,
            validUntil,
            allowSignatures: false,
            permissions: [
              {
                type: "functions-on-contract",
                address: uniswapV3Routers[chainId],
                functions: swapSelectors,
              },
              { type: "native-token-transfer", allowance: 0n },
            ],
          }),
        ),
      },
      policies: [],
    };
  },
} satisfies Template<typeof UniswapSessionInput>;
