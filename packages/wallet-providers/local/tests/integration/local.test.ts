import { createHash, createPublicKey, verify } from "node:crypto";
import { access, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Schema } from "effect";

import { SigningKeyId } from "@namera-ai/protocol";
import { p256 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";

import { LocalConfig } from "../../src/config.js";
import { LocalService } from "../../src/index.js";
import { CreateKeyInput } from "../../src/schemas.js";

it.effect("preserves the pre-split default key directory", () =>
  Effect.gen(function* () {
    const config = yield* LocalConfig;
    expect(config.directory).toBe(
      new URL("../../../../../.data/wallet-keys/", import.meta.url).pathname,
    );
  }).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))),
);

it.effect("reopens persisted keys without overwriting them", () =>
  withLocalService((directory) =>
    Effect.gen(function* () {
      const local = yield* LocalService;
      const input = {
        id: signingKeyIds.p256,
        algorithm: "p256",
        protectionLevel: "software",
      } as const;
      const key = yield* local.createKey(input);
      const path = join(directory, key.data.fileName);
      const original = yield* Effect.promise(() => readFile(path, "utf8"));
      expect((yield* Effect.promise(() => stat(path))).mode & 0o777).toBe(0o600);
      expect((yield* Effect.promise(() => stat(directory))).mode & 0o777).toBe(0o700);
      expect(yield* local.createKey(input).pipe(Effect.flip)).toMatchObject({
        operation: "create",
      });
      expect(yield* Effect.promise(() => readFile(path, "utf8"))).toBe(original);

      const message = new TextEncoder().encode("existing key after provider split");
      const signature = yield* Effect.gen(function* () {
        const reopened = yield* LocalService;
        return yield* reopened.signMessage({ algorithm: "p256", data: key.data, message });
      }).pipe(
        Effect.provide(
          LocalService.layer.pipe(
            Layer.provide(
              ConfigProvider.layer(
                ConfigProvider.fromUnknown({ WALLET_KEYS_LOCAL_DIRECTORY: directory }),
              ),
            ),
          ),
        ),
      );
      expect(
        verify("sha256", message, createPublicKey(JSON.parse(original).privateKeyPem), signature),
      ).toBe(true);
      expect(
        yield* local
          .signMessage({ algorithm: "ed25519", data: key.data, message })
          .pipe(Effect.flip),
      ).toMatchObject({ operation: "sign" });
      expect(
        yield* local
          .signDigest({ algorithm: "p256", data: key.data, hash: new Uint8Array(31) })
          .pipe(Effect.flip),
      ).toMatchObject({ operation: "sign" });
    }),
  ),
);

const signingKeyIds = {
  p256: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000001"),
  ed25519: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000002"),
  secp256k1: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000003"),
  disabled: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000004"),
  destroyed: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000005"),
} as const;

const withLocalService = <A, E>(
  makeEffect: (directory: string) => Effect.Effect<A, E, LocalService>,
) =>
  Effect.acquireUseRelease(
    Effect.promise(() => mkdtemp(join(tmpdir(), "namera-wallet-keys-"))),
    (directory) =>
      makeEffect(directory).pipe(
        Effect.provide(
          LocalService.layer.pipe(
            Layer.provide(
              ConfigProvider.layer(
                ConfigProvider.fromUnknown({ WALLET_KEYS_LOCAL_DIRECTORY: directory }),
              ),
            ),
          ),
        ),
      ),
    (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
  );

const createLocalKey = Effect.fn("wallet-providers.local.test.createLocalKey")(function* (
  input: CreateKeyInput,
) {
  const local = yield* LocalService;
  const key = yield* local.createKey(input);
  return key;
});

const readPrivateKey = Effect.fn("wallet-providers.local.test.readPrivateKey")(function* (
  directory: string,
  fileName: string,
) {
  const encoded = yield* Effect.promise(() => readFile(join(directory, fileName), "utf8"));
  return (JSON.parse(encoded) as { readonly privateKeyPem: string }).privateKeyPem;
});

it.effect("rejects 1Claw creation without creating local key material", () =>
  withLocalService((directory) =>
    Effect.gen(function* () {
      const local = yield* LocalService;
      const input = {
        id: signingKeyIds.secp256k1,
        organizationId: "0198a6f0-0000-7000-8000-000000000006",
        credentialId: "0198a6f0-0000-7000-8000-000000000007",
        provider: "1claw",
        chain: "ethereum",
        algorithm: "secp256k1",
      } as unknown as CreateKeyInput;
      const error = yield* local.createKey(input).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "LocalKeyError", operation: "create" });
      expect(yield* Effect.promise(() => readdir(directory))).toEqual([]);
    }),
  ),
);

it.effect("creates keys and signs messages with each supported algorithm", () =>
  withLocalService((directory) =>
    Effect.gen(function* () {
      const local = yield* LocalService;
      const message = new TextEncoder().encode("namera local wallet key lifecycle");
      const inputs = [
        { id: signingKeyIds.p256, algorithm: "p256", protectionLevel: "software" },
        { id: signingKeyIds.ed25519, algorithm: "ed25519", protectionLevel: "software" },
        { id: signingKeyIds.secp256k1, algorithm: "secp256k1", protectionLevel: "hsm" },
      ] as const;

      for (const input of inputs) {
        const key = yield* createLocalKey(Schema.decodeUnknownSync(CreateKeyInput)(input));
        const signature = yield* local.signMessage({
          algorithm: input.algorithm,
          data: key.data,
          message,
        });
        const privateKeyPem = yield* readPrivateKey(directory, key.data.fileName);

        expect(
          verify(
            input.algorithm === "ed25519" ? null : "sha256",
            message,
            createPublicKey(privateKeyPem),
            signature,
          ),
        ).toBe(true);
        expect(key.publicKeyHex.startsWith("0x")).toBe(true);
      }
    }),
  ),
);

it.effect("signs caller-provided hashes without hashing them again", () =>
  withLocalService(() =>
    Effect.gen(function* () {
      const local = yield* LocalService;
      const hash = createHash("sha256").update("already hashed").digest();
      const inputs = [
        { id: signingKeyIds.p256, algorithm: "p256", protectionLevel: "software", curve: p256 },
        {
          id: signingKeyIds.secp256k1,
          algorithm: "secp256k1",
          protectionLevel: "hsm",
          curve: secp256k1,
        },
      ] as const;

      for (const input of inputs) {
        const key = yield* createLocalKey(Schema.decodeUnknownSync(CreateKeyInput)(input));
        const signature = yield* local.signDigest({
          algorithm: input.algorithm,
          data: key.data,
          hash,
        });

        expect(
          input.curve.verify(signature, hash, Buffer.from(key.publicKeyHex.slice(2), "hex"), {
            format: "der",
            lowS: true,
            prehash: false,
          }),
        ).toBe(true);
      }
    }),
  ),
);

it.effect("rejects signing after a local key is disabled", () =>
  withLocalService(() =>
    Effect.gen(function* () {
      const local = yield* LocalService;
      const key = yield* createLocalKey({
        id: signingKeyIds.disabled,
        algorithm: "p256",
        protectionLevel: "software",
      });

      yield* local.disableKey({ data: key.data });
      const error = yield* local
        .signMessage({
          algorithm: "p256",
          data: key.data,
          message: new Uint8Array([1]),
        })
        .pipe(Effect.flip);

      expect(error).toMatchObject({ _tag: "LocalKeyError", operation: "sign" });
    }),
  ),
);

it.effect("destroys local key material", () =>
  withLocalService((directory) =>
    Effect.gen(function* () {
      const local = yield* LocalService;
      const key = yield* createLocalKey({
        id: signingKeyIds.destroyed,
        algorithm: "ed25519",
        protectionLevel: "software",
      });
      const path = join(directory, key.data.fileName);

      yield* local.destroyKey({ data: key.data });
      const exists = yield* Effect.promise(() =>
        access(path).then(
          () => true,
          () => false,
        ),
      );

      expect(exists).toBe(false);
    }),
  ),
);
