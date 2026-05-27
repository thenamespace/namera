import { Schema, SchemaTransformation } from "effect";

export const BigIntFromNumber = Schema.Int.pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      encode: (v) => Number(v),
      decode: (v) => BigInt(v),
    }),
  ),
);
