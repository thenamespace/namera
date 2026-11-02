import { Schema } from "effect";

import { Hex } from "@namera-ai/protocol/evm";

import type { Recipe } from "#/definition";
import { ensNetworks, ensPaymentTokens } from "#/ens/deployments";
import { buildEnsRegistrarSession, EnsRegistrarInput } from "#/ens/registrar";

// commit(bytes32), register(string,address,bytes32,address,address,uint64,address,bytes32).
const registrationSelectors = [Hex.make("0xf14fcbc8"), Hex.make("0xcff3e7c2")];

export const ensRegistrationRecipe = {
  id: "ens-registration",
  version: 1,
  display: {
    name: "ENS Registration Template",
    description: "Let an agent register .eth names with your selected payment tokens and expiry.",
    logo: "address-catalog/eip155/contract/ens.png",
    banner: "templates/ens-registration/header.webp",
    tags: ["ENSv2", "Name registration", "Ethereum"],
  },
  inputSchema: EnsRegistrarInput,
  metadata: { name: "ENS registrations", logo: { type: "emoji", value: "🏷️" } },
  defaults: { networks: [], tokens: ["usdc", "dai"], expiresAt: "" },
  fields: [
    { name: "networks", kind: "networks", label: "Networks", chainIds: ensNetworks },
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
    const values = Schema.decodeUnknownSync(EnsRegistrarInput)(input);

    return buildEnsRegistrarSession(values, now, registrationSelectors);
  },
} satisfies Recipe<typeof EnsRegistrarInput>;
