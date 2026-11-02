import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { Hex } from "@namera-ai/protocol/evm";

import type { Recipe } from "#/definition";
import { recipeValidUntil } from "#/inputs/expiry";

import { ensPaymentTokens, ensRenewalDeployments, ensRenewalNetworks } from "./deployments.js";
import { EnsRenewalInput } from "./input.js";

// renew((string,uint64,bytes32),address) and approve(address,uint256).
const renewSelector = Hex.make("0x2d06649b");
const approveSelector = Hex.make("0x095ea7b3");

export const ensRenewalRecipe = {
  id: "ens-renewal",
  version: 1,
  display: {
    name: "ENS Renewal Template",
    description: "Let an agent renew .eth names with your selected payment tokens and expiry.",
    logo: "address-catalog/eip155/contract/ens.png",
    banner: "templates/ens-renewal/header.webp",
    tags: ["ENSv2", "Name renewal", "Ethereum"],
  },
  inputSchema: EnsRenewalInput,
  metadata: {
    name: "ENS renewals",
    logo: { type: "emoji", value: "🔄" },
  },
  defaults: { networks: [], tokens: ["usdc", "dai"], expiresAt: "" },
  fields: [
    { name: "networks", kind: "networks", label: "Networks", chainIds: ensRenewalNetworks },
    {
      name: "tokens",
      kind: "tokens",
      label: "Payment tokens",
      description: "Choose which tokens this agent can approve. Sepolia uses ENS mock tokens.",
      options: ensPaymentTokens,
    },
    { name: "expiresAt", kind: "expiry", label: "Expires on" },
  ],
  build(input, { now }) {
    const values = Schema.decodeUnknownSync(EnsRenewalInput)(input);
    const validUntil = recipeValidUntil(values.expiresAt, now);

    return {
      onchain: {
        installations: values.networks.map((chainId) => {
          const deployment = ensRenewalDeployments[chainId];

          return CreateEvmSessionInstallation.make({
            chainId,
            validAfter: now,
            validUntil,
            allowSignatures: false,
            permissions: [
              {
                type: "functions-on-contract",
                address: deployment.registrar,
                functions: [renewSelector],
              },
              ...values.tokens.map((token) => ({
                type: "functions-on-contract" as const,
                address: deployment.tokens[token],
                functions: [approveSelector],
              })),
              { type: "native-token-transfer", allowance: 0n },
            ],
          });
        }),
      },
      policies: [],
    };
  },
} satisfies Recipe<typeof EnsRenewalInput>;
