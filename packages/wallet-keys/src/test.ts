import { Effect, Schema } from "effect";

import { Hex } from "@namera-ai/protocol";

import type { WalletKeysService } from "./service.js";

export const makeTestWalletKeys = (): WalletKeysService => ({
  create: Effect.fn("wallet-keys.test.create")((input) =>
    Effect.succeed({
      provider: "local",
      algorithm: input.algorithm,
      protectionLevel: input.protectionLevel,
      publicKeyHex: Schema.decodeSync(Hex)(
        input.algorithm === "ed25519" ? `0x${"00".repeat(32)}` : `0x04${"00".repeat(64)}`,
      ),
      data: { version: 1, fileName: `${input.id}.json` },
    } as const),
  ),
  signMessage: Effect.fn("wallet-keys.test.signMessage")((input) =>
    Effect.succeed(
      input.algorithm === "ed25519"
        ? new Uint8Array(64)
        : new Uint8Array([48, 6, 2, 1, 1, 2, 1, 1]),
    ),
  ),
  signHash: Effect.fn("wallet-keys.test.signHash")(() =>
    Effect.succeed(new Uint8Array([48, 6, 2, 1, 1, 2, 1, 1])),
  ),
  disable: Effect.fn("wallet-keys.test.disable")(() => Effect.succeed(undefined)),
  destroy: Effect.fn("wallet-keys.test.destroy")(() => Effect.succeed(undefined)),
});
