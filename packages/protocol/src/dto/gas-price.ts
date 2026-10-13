import { Schema } from "effect";

export const EvmNativePriceQuote = Schema.Struct({
  ethUsd: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0)),
  usdcUsd: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0)),
  quotedAt: Schema.DateTimeUtcFromString,
});
export type EvmNativePriceQuote = typeof EvmNativePriceQuote.Type;
