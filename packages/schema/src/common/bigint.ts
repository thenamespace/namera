import { Schema, SchemaTransformation } from "effect";

export const BigIntFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      encode: (v) => v.toString(),
      decode: (v) => BigInt(v),
    }),
  ),
);
