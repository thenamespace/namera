import { Schema } from "effect";

import { CreateEvmSessionInstallation } from "@namera-ai/protocol/dto";
import { Hex } from "@namera-ai/protocol/evm";

import type { RecipeOutput } from "#/definition";
import { RecipeExpiry, recipeValidUntil } from "#/inputs/expiry";

import { ensDeployments, ensNetworks } from "./deployments.js";

export const EnsRegistrarInput = Schema.Struct({
  networks: Schema.Array(Schema.Literals(ensNetworks)).check(
    Schema.isMinLength(1, { message: "Choose at least one network." }),
    Schema.makeFilter((networks) =>
      new Set(networks).size === networks.length ? undefined : "Choose unique networks.",
    ),
  ),
  tokens: Schema.Array(Schema.Literals(["usdc", "dai"])).check(
    Schema.isMinLength(1, { message: "Choose at least one payment token." }),
    Schema.makeFilter((tokens) =>
      new Set(tokens).size === tokens.length ? undefined : "Choose unique payment tokens.",
    ),
  ),
  expiresAt: RecipeExpiry,
});

const approveSelector = Hex.make("0x095ea7b3");

export function buildEnsRegistrarSession(
  input: typeof EnsRegistrarInput.Type,
  now: number,
  functions: readonly Hex[],
): RecipeOutput {
  const validUntil = recipeValidUntil(input.expiresAt, now);

  return {
    onchain: {
      installations: input.networks.map((chainId) => {
        const deployment = ensDeployments[chainId];

        return CreateEvmSessionInstallation.make({
          chainId,
          validAfter: now,
          validUntil,
          allowSignatures: false,
          permissions: [
            { type: "functions-on-contract", address: deployment.registrar, functions },
            ...input.tokens.map((token) => ({
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
}
