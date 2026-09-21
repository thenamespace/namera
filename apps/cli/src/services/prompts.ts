import { Context, Effect, Layer, Schema } from "effect";
import { Prompt } from "effect/unstable/cli";

import {
  EthereumAddress,
  EvmTypedData,
  Hex,
  SessionKeyId,
  SupportedEvmChainId,
  WalletId,
} from "@namera-ai/protocol";

const schemaText = (message: string, schema: Schema.Decoder<unknown>, defaultValue?: string) =>
  Prompt.String({
    message,
    ...(defaultValue === undefined ? {} : { default: defaultValue }),
    validate: (value) =>
      Schema.decodeUnknownEffect(schema)(value).pipe(
        Effect.as(value),
        Effect.mapError((error) => error.message),
      ),
  });

const makePrompts = () => ({
  namespace: Prompt.run(
    Prompt.Select({
      message: "Namespace",
      choices: [
        { title: "EVM", description: "Ethereum and EVM-compatible networks", value: "eip155" },
      ],
    }),
  ),
  walletId: (message = "Wallet ID") =>
    Prompt.run(schemaText(message, WalletId)).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(WalletId)),
    ),
  chainId: (message = "Chain") =>
    Prompt.run(schemaText(message, SupportedEvmChainId, "eip155:11155111")).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(SupportedEvmChainId)),
    ),
  sessionKeyId: (message = "Session key ID") =>
    Prompt.run(schemaText(message, SessionKeyId)).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(SessionKeyId)),
    ),
  ethereumAddress: (message: string) =>
    Prompt.run(schemaText(message, EthereumAddress)).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(EthereumAddress)),
    ),
  ethereumValue: (message = "Native value (wei)") =>
    Prompt.run(
      schemaText(
        message,
        Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n)),
        "0",
      ),
    ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.BigIntFromString))),
  hex: (message: string, defaultValue = "0x") =>
    Prompt.run(schemaText(message, Hex, defaultValue)).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Hex)),
    ),
  integer: (message: string, options?: { readonly min?: number; readonly default?: number }) =>
    Prompt.run(Prompt.Int({ message, ...options })),
  confirm: (message: string, initial = false) => Prompt.run(Prompt.Confirm({ message, initial })),
  signatureType: Prompt.run(
    Prompt.Select({
      message: "Signature type",
      choices: [
        { title: "Message", description: "Sign or verify a UTF-8 message", value: "message" },
        {
          title: "Typed data",
          description: "Sign or verify an EIP-712 typed-data object",
          value: "typed-data",
        },
      ],
    }),
  ),
  message: (message = "Message") => Prompt.run(Prompt.String({ message })),
  typedData: Prompt.run(
    Prompt.String({
      message: "EIP-712 typed data (JSON)",
      validate: (value) =>
        Schema.decodeUnknownEffect(Schema.fromJsonString(EvmTypedData))(value).pipe(
          Effect.as(value),
          Effect.mapError((error) => error.message),
        ),
    }),
  ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(EvmTypedData)))),
  date: (message: string) => Prompt.run(Prompt.Date({ message })),
});

export type CliPromptsService = ReturnType<typeof makePrompts>;

export class CliPrompts extends Context.Service<CliPrompts, CliPromptsService>()(
  "@namera-ai/cli/CliPrompts",
) {
  static readonly layer = Layer.succeed(CliPrompts, CliPrompts.of(makePrompts()));
}
