import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { Hex } from "@namera-ai/protocol/evm";

import type { Template } from "#/definition";
import { templateValidUntil } from "#/inputs/expiry";
import { uniswapV3Networks, uniswapV3PositionManagers } from "#/uniswap/deployments";

import { UniswapV3LiquidityInput } from "./input.js";

// INonfungiblePositionManager from @uniswap/v3-periphery@1.4.4.
const mintSelector = Hex.make("0x88316456");
const increaseSelector = Hex.make("0x219f5d17");
const decreaseSelector = Hex.make("0x0c49ccbe");
const collectSelector = Hex.make("0xfc6f7865");

export const uniswapV3LiquidityTemplate = {
  id: "uniswap-v3-liquidity",
  version: 1,
  display: {
    name: "Uniswap v3 Liquidity Manager Template",
    description:
      "Choose how an agent can create, fund, withdraw from, and collect Uniswap v3 positions.",
    logo: "templates/uniswap-v3-swaps/logo.webp",
    banner: "templates/uniswap-v3-liquidity/header.webp",
    tags: ["Uniswap v3", "Liquidity", "DeFi"],
  },
  inputSchema: UniswapV3LiquidityInput,
  metadata: { name: "Uniswap liquidity", logo: { type: "emoji", value: "🦄" } },
  defaults: {
    networks: [],
    createPositions: false,
    addLiquidity: false,
    removeLiquidity: false,
    collectProceeds: true,
    expiresAt: "",
  },
  fields: [
    { name: "networks", kind: "networks", label: "Networks", chainIds: uniswapV3Networks },
    {
      name: "createPositions",
      kind: "checkbox",
      label: "Create positions",
      tooltip: "Create a liquidity position in an existing pool.",
    },
    {
      name: "addLiquidity",
      kind: "checkbox",
      label: "Add liquidity",
      tooltip: "Deposit approved tokens into a position.",
    },
    {
      name: "removeLiquidity",
      kind: "checkbox",
      label: "Remove liquidity",
      tooltip: "Reduce liquidity; collect proceeds separately.",
    },
    {
      name: "collectProceeds",
      kind: "checkbox",
      label: "Collect proceeds",
      tooltip: "Claim fees and previously withdrawn tokens.",
    },
    { name: "expiresAt", kind: "expiry", label: "Expires on" },
  ],
  approvalNote:
    "Before adding liquidity, approve the input tokens to the Uniswap position manager on the selected network.",
  approvalNoteWhen: ["createPositions", "addLiquidity"],
  build(input, { now }) {
    const values = Schema.decodeUnknownSync(UniswapV3LiquidityInput)(input);
    const validUntil = templateValidUntil(values.expiresAt, now);
    const functions = [
      ...(values.createPositions ? [mintSelector] : []),
      ...(values.addLiquidity ? [increaseSelector] : []),
      ...(values.removeLiquidity ? [decreaseSelector] : []),
      ...(values.collectProceeds ? [collectSelector] : []),
    ];

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
                address: uniswapV3PositionManagers[chainId],
                functions,
              },
              { type: "native-token-transfer", allowance: 0n },
            ],
          }),
        ),
      },
      policies: [],
    };
  },
} satisfies Template<typeof UniswapV3LiquidityInput>;
