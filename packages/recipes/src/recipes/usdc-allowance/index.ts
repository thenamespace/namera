import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";

import type { Recipe } from "#/definition";

import { usdcDeployments, usdcNetworks } from "./deployments.js";
import { UsdcAllowanceInput, usdcBaseUnits } from "./input.js";

export const usdcAllowanceRecipe = {
  id: "usdc-lifetime-allowance",
  version: 1,
  display: {
    name: "USDC lifetime allowance",
    description: "Set a total USDC spending allowance on each selected network.",
    logo: { type: "emoji", value: "💵" },
    tags: ["USDC", "Token spending", "Multi-network"],
  },
  inputSchema: UsdcAllowanceInput,
  defaults: { networks: [], allowance: "", durationDays: "30" },
  fields: [
    { name: "networks", kind: "networks", label: "Networks", chainIds: usdcNetworks },
    {
      name: "allowance",
      kind: "amount",
      label: "Lifetime allowance per network",
      description:
        "Each network gets its own allowance. It does not reset or pool across networks.",
      symbol: "USDC",
      decimals: 6,
    },
    { name: "durationDays", kind: "duration", label: "Expires after", min: 1, max: 3650 },
  ],
  build(input, { now }) {
    const values = Schema.decodeUnknownSync(UsdcAllowanceInput)(input);
    const validUntil = now + Number(values.durationDays) * 86_400;
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
                type: "erc20-token-transfer",
                address: usdcDeployments[chainId],
                allowance: usdcBaseUnits(values.allowance),
              },
            ],
          }),
        ),
      },
      policies: [],
    };
  },
} satisfies Recipe<typeof UsdcAllowanceInput>;
