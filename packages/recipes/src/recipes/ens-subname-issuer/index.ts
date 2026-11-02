import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { Hex } from "@namera-ai/protocol/evm";

import type { Recipe } from "#/definition";
import { ensNetworks } from "#/ens/deployments";
import { recipeValidUntil } from "#/inputs/expiry";

import { EnsSubnameIssuerInput } from "./input.js";

// IPermissionedRegistry.register(string,address,address,address,uint256,uint64).
const registerSelector = Hex.make("0x85f3e643");

export const ensSubnameIssuerRecipe = {
  id: "ens-subname-issuer",
  version: 1,
  display: {
    name: "ENS Subname Issuer Template",
    description: "Let an agent issue subnames from your ENSv2 registry until a chosen expiry.",
    logo: "address-catalog/eip155/contract/ens.png",
    banner: "templates/ens-subname-issuer/header.webp",
    tags: ["ENSv2", "Subnames", "Ethereum"],
  },
  inputSchema: EnsSubnameIssuerInput,
  metadata: { name: "ENS subnames", logo: { type: "emoji", value: "🌱" } },
  defaults: { networks: [], subregistryAddress: "", expiresAt: "" },
  fields: [
    { name: "networks", kind: "network", label: "Network", chainIds: ensNetworks },
    {
      name: "subregistryAddress",
      kind: "address",
      label: "Registry address",
      placeholder: "0x…",
      description: "Your account must already have the registrar role on this ENSv2 registry.",
    },
    { name: "expiresAt", kind: "expiry", label: "Expires on" },
  ],
  build(input, { now }) {
    const values = Schema.decodeUnknownSync(EnsSubnameIssuerInput)(input);
    const validUntil = recipeValidUntil(values.expiresAt, now);

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
                address: values.subregistryAddress,
                functions: [registerSelector],
              },
              { type: "native-token-transfer", allowance: 0n },
            ],
          }),
        ),
      },
      policies: [],
    };
  },
} satisfies Recipe<typeof EnsSubnameIssuerInput>;
