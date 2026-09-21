import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect";

import { ens_normalize } from "@adraffy/ens-normalize";

const NormalizedEnsLabel = Schema.String.pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.transformEffect({
      decode: (input, options) => {
        try {
          return Effect.succeed(ens_normalize(input.trim()));
        } catch {
          return Effect.fail(
            new SchemaIssue.InvalidValue({ message: "Enter a valid ENS label" }, input, options),
          );
        }
      },
      encode: Effect.succeed,
    }),
  ),
);

export const EnsLabel = NormalizedEnsLabel.pipe(
  Schema.check(
    Schema.isPattern(/^[^.]+$/, { message: "Enter a label without a domain suffix" }),
    Schema.isMinLength(4, { message: "ENS label must be at least 4 characters" }),
    Schema.isMaxLength(63, { message: "ENS label must be at most 63 characters" }),
  ),
).annotate({
  identifier: "EnsLabel",
  description: "An ENSIP-normalized label for a Namera account subname",
});

export type EnsLabel = typeof EnsLabel.Type;
