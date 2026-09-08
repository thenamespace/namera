import { Option, Schema, SchemaGetter } from "effect";

import { MetadataDescription } from "@namera-ai/protocol/model";

export const OptionalFormDescription = Schema.optional(Schema.String).pipe(
  Schema.decodeTo(Schema.optionalKey(MetadataDescription), {
    decode: SchemaGetter.transformOptional((input) =>
      Option.flatMap(input, (value) =>
        value === undefined || value === "" ? Option.none() : Option.some(value),
      ),
    ),
    encode: SchemaGetter.transformOptional((input) => input),
  }),
);
