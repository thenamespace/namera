import { Schema } from "effect";

import { Hex } from "@namera-ai/protocol/evm";

import type { Template } from "#/definition";
import { ensPaymentTokens, ensNetworks } from "#/ens/deployments";
import { buildEnsRegistrarSession, EnsRegistrarInput } from "#/ens/registrar";

// renew((string,uint64,bytes32),address).
const renewSelector = Hex.make("0x2d06649b");

export const ensRenewalTemplate = {
  id: "ens-renewal",
  version: 1,
  display: {
    name: "ENS Renewal Template",
    description: "Let an agent renew .eth names with your selected payment tokens and expiry.",
    logo: "address-catalog/eip155/contract/ens.png",
    banner: "templates/ens-renewal/header.webp",
    tags: ["ENSv2", "Name renewal", "Ethereum"],
  },
  inputSchema: EnsRegistrarInput,
  metadata: {
    name: "ENS renewals",
    logo: { type: "emoji", value: "🔄" },
  },
  defaults: { networks: [], tokens: ["usdc", "dai"], expiresAt: "" },
  fields: [
    { name: "networks", kind: "networks", label: "Networks", chainIds: ensNetworks },
    {
      name: "tokens",
      kind: "tokens",
      label: "Payment tokens",
      options: ensPaymentTokens,
    },
    { name: "expiresAt", kind: "expiry", label: "Expires on" },
  ],
  build(input, { now }) {
    const values = Schema.decodeUnknownSync(EnsRegistrarInput)(input);

    return buildEnsRegistrarSession(values, now, [renewSelector]);
  },
} satisfies Template<typeof EnsRegistrarInput>;
