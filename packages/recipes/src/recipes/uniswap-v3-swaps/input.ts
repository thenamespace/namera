import { Schema } from "effect";

import { RecipeExpiry } from "#/inputs/expiry";

import { uniswapV3Networks } from "./deployments.js";

export const UniswapV3SwapsInput = Schema.Struct({
  networks: Schema.Array(Schema.Literals(uniswapV3Networks)).check(
    Schema.isMinLength(1, { message: "Choose at least one network." }),
    Schema.makeFilter((networks) =>
      new Set(networks).size === networks.length ? undefined : "Choose unique networks.",
    ),
  ),
  expiresAt: RecipeExpiry,
});
