import { Schema } from "effect";

import { Hex } from "@namera-ai/protocol/evm";

import type { Template } from "#/definition";
import { ensDeployments, ensNetworks, ensPaymentTokens } from "#/ens/deployments";
import { buildEnsRegistrarSession, EnsRegistrarInput } from "#/ens/registrar";

// commit(bytes32), register(string,address,bytes32,address,address,uint64,address,bytes32).
const registrationSelectors = [Hex.make("0xf14fcbc8"), Hex.make("0xcff3e7c2")];
// VerifiableFactory.deployProxy(address,uint256,bytes).
const deployProxySelector = Hex.make("0x5d84121a");
const EnsRegistrationInput = Schema.Struct({
  ...EnsRegistrarInput.fields,
  allowFactoryDeployments: Schema.Boolean,
});

export const ensRegistrationTemplate = {
  id: "ens-registration",
  version: 2,
  display: {
    name: "ENS Registration Template",
    description: "Let an agent register .eth names with your selected payment tokens and expiry.",
    logo: "address-catalog/eip155/contract/ens.png",
    banner: "templates/ens-registration/header.webp",
    tags: ["ENSv2", "Name registration", "Ethereum"],
  },
  inputSchema: EnsRegistrationInput,
  metadata: { name: "ENS registrations", logo: { type: "emoji", value: "🏷️" } },
  defaults: { networks: [], tokens: ["usdc", "dai"], allowFactoryDeployments: true, expiresAt: "" },
  fields: [
    { name: "networks", kind: "networks", label: "Networks", chainIds: ensNetworks },
    {
      name: "tokens",
      kind: "tokens",
      label: "Payment tokens",
      options: ensPaymentTokens,
    },
    {
      name: "allowFactoryDeployments",
      kind: "checkbox",
      label: "Allow resolver deployments",
      tooltip:
        "Allows proxy deployments with any implementation and initialization data, including Permissioned Resolvers.",
    },
    { name: "expiresAt", kind: "expiry", label: "Expires on" },
  ],
  build(input, { now }) {
    const values = Schema.decodeUnknownSync(EnsRegistrationInput)(input);
    const generated = buildEnsRegistrarSession(values, now, registrationSelectors);
    if (!values.allowFactoryDeployments) return generated;

    return {
      ...generated,
      onchain: {
        installations: generated.onchain.installations.map((installation) => ({
          chainId: installation.chainId,
          validAfter: installation.validAfter,
          validUntil: installation.validUntil,
          allowSignatures: false,
          permissions: [
            ...installation.permissions,
            {
              type: "functions-on-contract" as const,
              address: ensDeployments[installation.chainId as (typeof ensNetworks)[number]].factory,
              functions: [deployProxySelector],
            },
          ],
        })),
      },
    };
  },
} satisfies Template<typeof EnsRegistrationInput>;
