import { Context, Effect, Layer, Schema } from "effect";

import { Hex, type WalletKeyError } from "@namera-ai/protocol";

import type { CreatedWalletKey, CreateWalletKeyInput, SignWalletKeyInput } from "./data.js";

export interface WalletKeysService {
  readonly create: (input: CreateWalletKeyInput) => Effect.Effect<CreatedWalletKey, WalletKeyError>;
  readonly sign: (input: SignWalletKeyInput) => Effect.Effect<Uint8Array, WalletKeyError>;
}

export class WalletKeys extends Context.Service<WalletKeys, WalletKeysService>()(
  "@namera-ai/wallet-keys/WalletKeys",
) {
  static readonly testLayer = Layer.succeed(
    WalletKeys,
    WalletKeys.of({
      create: Effect.fn("WalletKeys.test.create")((input) =>
        Effect.succeed({
          provider: "local",
          algorithm: input.algorithm,
          protectionLevel: input.protectionLevel,
          keyVersionName: input.id,
          publicKeyHex: Schema.decodeSync(Hex)(`0x04${"00".repeat(64)}`),
          data: { version: 1, fileName: `${input.id}.json` },
        } as const),
      ),
      sign: Effect.fn("WalletKeys.test.sign")(() =>
        Effect.succeed(new Uint8Array([48, 6, 2, 1, 1, 2, 1, 1])),
      ),
    }),
  );
}
