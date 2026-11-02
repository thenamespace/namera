import { Schema } from "effect";

import { TemplateExpiry } from "#/inputs/expiry";

import { uniswapV3Networks } from "./deployments.js";

export const UniswapSessionInput = Schema.Struct({
  networks: Schema.Array(Schema.Literals(uniswapV3Networks)).check(
    Schema.isMinLength(1, { message: "Choose at least one network." }),
    Schema.makeFilter((networks) =>
      new Set(networks).size === networks.length ? undefined : "Choose unique networks.",
    ),
  ),
  expiresAt: TemplateExpiry,
});
