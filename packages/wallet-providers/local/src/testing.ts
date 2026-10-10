import { Effect, Schema } from "effect";

import { Hex } from "@namera-ai/protocol";

import type { LocalOperations } from "#/service";

export const makeTestLocal = (): LocalOperations => ({
  createKey: Effect.fn("wallet-providers.local.test.create")((input) => {
    const seed = input.id.replaceAll("-", "").repeat(4).slice(0, 128);
    return Effect.succeed({
      algorithm: input.algorithm,
      protectionLevel: input.protectionLevel,
      publicKeyHex: Schema.decodeUnknownSync(Hex)(
        input.algorithm === "ed25519" ? `0x${seed.slice(0, 64)}` : `0x04${seed}`,
      ),
      data: { version: 1, fileName: `${input.id}.json` },
    } as const);
  }),
  signMessage: (input) =>
    Effect.succeed(
      input.algorithm === "ed25519"
        ? new Uint8Array(64)
        : new Uint8Array([48, 6, 2, 1, 1, 2, 1, 1]),
    ),
  signDigest: () => Effect.succeed(new Uint8Array([48, 6, 2, 1, 1, 2, 1, 1])),
  disableKey: () => Effect.void,
  destroyKey: () => Effect.void,
});
