import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Schema } from "effect";

import { SigningKeyId } from "@namera-ai/protocol";

import { LocalService, LocalKeyError } from "../../src/index.js";

it.effect("needs no provider configuration and rejects every managed-key operation", () =>
  Effect.gen(function* () {
    const keys = yield* LocalService;
    const stored = {
      algorithm: "p256",
      data: { version: 1, fileName: "unused.json" },
    } as const;
    const operations: ReadonlyArray<
      readonly [Effect.Effect<unknown, LocalKeyError>, LocalKeyError["operation"]]
    > = [
      [
        keys.createKey({
          id: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000001"),
          algorithm: "p256",
          protectionLevel: "software",
        }),
        "create",
      ],
      [keys.signMessage({ ...stored, message: new Uint8Array(1) }), "sign"],
      [keys.signDigest({ ...stored, hash: new Uint8Array(32) }), "sign"],
      [keys.disableKey(stored), "disable"],
      [keys.destroyKey(stored), "destroy"],
    ] as const;
    for (const [operation, name] of operations) {
      const error = yield* Effect.flip(operation);
      expect(error).toBeInstanceOf(LocalKeyError);
      expect(error.operation).toBe(name);
    }
  }).pipe(
    Effect.provide(
      LocalService.disabledLayer.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
      ),
    ),
  ),
);
