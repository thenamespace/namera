import { DateTime, Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";

import type { Recipe } from "#/definition";

import { usdcDeployments, usdcNetworks } from "./deployments.js";
import { UsdcAllowanceInput, usdcBaseUnits } from "./input.js";

export const usdcAllowanceRecipe = {
  id: "usdc-lifetime-allowance",
  version: 2,
  display: {
    name: "Spend USDC with a fixed budget",
    description:
      "Give an agent or app permission to spend USDC up to a limit you choose. Select the networks and an expiry date. Each network gets its own full budget, which does not reset or carry over to another network.",
    logo: { type: "image", value: "https://cdn.namera.ai/address-catalog/eip155/erc20/usdc.png" },
    banner: "https://api.dicebear.com/10.x/glass/svg?seed=namera-usdc-budget&size=600",
    tags: ["USDC", "Token spending", "Multi-network"],
  },
  inputSchema: UsdcAllowanceInput,
  defaults: { networks: [], allowance: "", expiresAt: "" },
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
    {
      name: "expiresAt",
      kind: "expiry",
      label: "Expires on",
      description: "Expires at the start of this date in your local time zone.",
    },
  ],
  build(input, { now }) {
    const values = Schema.decodeUnknownSync(UsdcAllowanceInput)(input);
    const validUntil = Math.floor(
      DateTime.toEpochMillis(DateTime.makeUnsafe(values.expiresAt)) / 1000,
    );
    if (validUntil <= now) throw new Error("Choose an expiry date in the future.");
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
