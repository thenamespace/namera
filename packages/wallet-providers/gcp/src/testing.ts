import { Effect, Schema } from "effect";

import { Hex } from "@namera-ai/protocol";

import type { GcpOperations } from "#/service";

export const makeTestGcp = (): GcpOperations => ({
  createKey: Effect.fn("wallet-providers.gcp.test.create")((input) => {
    const seed = input.id.replaceAll("-", "").repeat(4).slice(0, 128);
    return Effect.succeed({
      algorithm: input.algorithm,
      protectionLevel: input.protectionLevel,
      publicKeyHex: Schema.decodeUnknownSync(Hex)(
        input.algorithm === "ed25519" ? `0x${seed.slice(0, 64)}` : `0x04${seed}`,
      ),
      data: {
        version: 1,
        providerAlgorithm:
          input.algorithm === "p256"
            ? "EC_SIGN_P256_SHA256"
            : input.algorithm === "secp256k1"
              ? "EC_SIGN_SECP256K1_SHA256"
              : "EC_SIGN_ED25519",
        keyVersionName: `test/keys/${input.id}/cryptoKeyVersions/1`,
      },
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
