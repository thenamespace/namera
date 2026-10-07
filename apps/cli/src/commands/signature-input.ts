import { Effect, Option, Schema } from "effect";

import { EvmTypedData } from "@namera-ai/protocol";

import { inputFailure, inputOrPrompt, optionalInput } from "#/commands/operation-input";
import { CliPrompts } from "#/services/prompts";

export const signatureFlags = {
  type: optionalInput("type", "What to sign or verify: message or typed-data"),
  message: optionalInput("message", "Exact UTF-8 message"),
  typedData: optionalInput("typed-data", "EIP-712 typed data as JSON"),
};

export const signatureInput = Effect.fnUntraced(function* (input: {
  readonly type: Option.Option<string>;
  readonly message: Option.Option<string>;
  readonly typedData: Option.Option<string>;
}) {
  const prompts = yield* CliPrompts;
  const type = yield* inputOrPrompt(
    input.type,
    "type",
    Schema.Literals(["message", "typed-data"]),
    prompts.signatureType,
  );
  if (type === "message") {
    if (Option.isSome(input.typedData))
      return yield* inputFailure(
        "Typed data cannot be used with --type message.",
        "Remove --typed-data, or use --type typed-data without --message.",
      );
    return {
      type,
      message: yield* inputOrPrompt(input.message, "message", Schema.String, prompts.message()),
    };
  }
  if (Option.isSome(input.message))
    return yield* inputFailure(
      "A message cannot be used with --type typed-data.",
      "Remove --message, or use --type message without --typed-data.",
    );
  return {
    type,
    typedData: yield* inputOrPrompt(
      input.typedData,
      "typed-data",
      Schema.fromJsonString(EvmTypedData),
      prompts.typedData,
    ),
  };
});
