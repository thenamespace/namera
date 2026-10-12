import { DateTime, Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";

import type { Recipe } from "#/definition";

import { usdcDeployments, usdcNetworks } from "./deployments.js";
import { UsdcAllowanceInput, usdcBaseUnits } from "./input.js";

export const usdcAllowanceRecipe = {
  id: "usdc-lifetime-allowance",
  version: 2,
  display: {
    name: "USDC Spend Recipe",
    description:
      "Let an agent spend USDC with a fixed budget per network and an expiry date you choose.",
    logo: { type: "image", value: "https://cdn.namera.ai/address-catalog/eip155/erc20/usdc.png" },
    banner: "https://api.dicebear.com/10.x/glass/svg?seed=namera-usdc-budget&size=600",
    tags: ["USDC", "Token spending", "Multi-network"],
  },
  inputSchema: UsdcAllowanceInput,
  metadata: { logo: { type: "emoji", value: "💵" } },
  defaults: { networks: [], allowance: "", expiresAt: "" },
  fields: [
    { name: "networks", kind: "networks", label: "Networks", chainIds: usdcNetworks },
    {
      name: "allowance",
      kind: "amount",
      label: "Lifetime allowance per network",
      symbol: "USDC",
      decimals: 6,
    },
    {
      name: "expiresAt",
      kind: "expiry",
      label: "Expires on",
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
