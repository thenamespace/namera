import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Schema } from "effect";

import { SigningKeyId, WalletKeyError } from "@namera-ai/protocol";

import { WalletKeys } from "../../src/index.js";

it.effect("needs no provider configuration and rejects every managed-key operation", () =>
  Effect.gen(function* () {
    const keys = yield* WalletKeys;
    const stored = {
      provider: "local",
      algorithm: "p256",
      data: { version: 1, fileName: "unused.json" },
    } as const;
    const operations: ReadonlyArray<
      readonly [Effect.Effect<unknown, WalletKeyError>, WalletKeyError["operation"]]
    > = [
      [
        keys.create({
          id: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000001"),
          algorithm: "p256",
          protectionLevel: "software",
        }),
        "create",
      ],
      [keys.signMessage({ ...stored, message: new Uint8Array(1) }), "sign"],
      [keys.signHash({ ...stored, hash: new Uint8Array(32) }), "sign"],
      [keys.disable(stored), "disable"],
      [keys.destroy(stored), "destroy"],
    ] as const;
    for (const [operation, name] of operations) {
      const error = yield* Effect.flip(operation);
      expect(error).toBeInstanceOf(WalletKeyError);
      expect(error.operation).toBe(name);
    }
  }).pipe(
    Effect.provide(
      WalletKeys.disabledLayer.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
      ),
    ),
  ),
);
