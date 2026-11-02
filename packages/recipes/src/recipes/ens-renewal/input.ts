import { Schema } from "effect";

import { RecipeExpiry } from "#/inputs/expiry";

import { ensRenewalNetworks } from "./deployments.js";

export const EnsRenewalInput = Schema.Struct({
  networks: Schema.Array(Schema.Literals(ensRenewalNetworks)).check(
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
