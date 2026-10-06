import { Option, Schema, type Effect } from "effect";
import { Flag } from "effect/cli";

export const profileFlag = Flag.String("profile").pipe(
  Flag.withDescription("Choose which saved connection to use"),
  Flag.withDefault("personal"),
);

export const paramsFlag = Flag.String("params").pipe(
  Flag.withDescription("Provide inputs as JSON instead of answering prompts"),
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
