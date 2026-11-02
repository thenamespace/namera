import { Schema } from "effect";

import { UniswapSessionInput } from "#/uniswap/input";

export const UniswapV3LiquidityInput = Schema.Struct({
  ...UniswapSessionInput.fields,
  createPositions: Schema.Boolean,
  addLiquidity: Schema.Boolean,
  removeLiquidity: Schema.Boolean,
  collectProceeds: Schema.Boolean,
}).check(
  Schema.makeFilter((input) =>
    input.createPositions || input.addLiquidity || input.removeLiquidity || input.collectProceeds
      ? undefined
      : { path: ["collectProceeds"], issue: "Choose at least one operation." },
  ),
);
