import { Option, Schema, type Effect } from "effect";
import { Flag } from "effect/unstable/cli";

export const profileFlag = Flag.string("profile").pipe(
  Flag.withDescription("CLI profile name"),
  Flag.withDefault("personal"),
);

export const paramsFlag = Flag.string("params").pipe(
  Flag.withDescription("Inline JSON command payload"),
  Flag.optional,
);

export const resolveParams = <S extends Schema.Top, E, R>(
  params: Option.Option<string>,
  schema: S,
  prompt: Effect.Effect<S["Type"], E, R>,
) =>
  Option.match(params, {
    onNone: () => prompt,
    onSome: (value) => Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(value),
  });
