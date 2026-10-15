import { createHash, createPublicKey, verify } from "node:crypto";
import { access, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Schema } from "effect";

import { SigningKeyId } from "@namera-ai/protocol";
import { p256 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";

import { LocalConfig } from "../../src/config.js";
import { LocalService } from "../../src/index.js";
import { CreateKeyInput } from "../../src/schemas.js";
import { localLayer, withLocalService, readPrivateKey } from "../fixtures/filesystem.js";

it.effect("defaults to the repository wallet-key directory", () =>
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

      const message = new TextEncoder().encode("existing key after reopening the provider");
      const signature = yield* Effect.gen(function* () {
        const reopened = yield* LocalService;
        return yield* reopened.signMessage({ algorithm: "p256", data: key.data, message });
      }).pipe(Effect.provide(localLayer(directory)));
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
        const key = yield* local.createKey(Schema.decodeUnknownSync(CreateKeyInput)(input));
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
        const key = yield* local.createKey(Schema.decodeUnknownSync(CreateKeyInput)(input));
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
      const key = yield* local.createKey({
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
      const key = yield* local.createKey({
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
      expect(
        yield* local
          .signMessage({ algorithm: "ed25519", data: key.data, message: new Uint8Array([1]) })
          .pipe(Effect.flip),
      ).toMatchObject({ operation: "sign" });
      yield* local.destroyKey({ data: key.data });
    }),
  ),
);

it.effect.each([
  { name: "truncated JSON", contents: '{"version":' },
  {
    name: "unsupported file version",
    contents: JSON.stringify({
      version: 2,
      algorithm: "p256",
      status: "active",
      privateKeyPem: "invalid",
    }),
  },
  {
    name: "invalid private material",
    contents: JSON.stringify({
      version: 1,
      algorithm: "p256",
      status: "active",
      privateKeyPem: "invalid",
    }),
  },
] as const)("rejects signing from $name without rewriting the key file", ({ contents }) =>
  withLocalService((directory) =>
    Effect.gen(function* () {
      const local = yield* LocalService;
      const key = yield* local.createKey({
        id: signingKeyIds.p256,
        algorithm: "p256",
        protectionLevel: "software",
      });
      const path = join(directory, key.data.fileName);
      yield* Effect.promise(() => writeFile(path, contents, "utf8"));
      expect(
        yield* local
          .signMessage({ algorithm: "p256", data: key.data, message: new Uint8Array([1]) })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "LocalKeyError", operation: "sign" });
      expect(yield* Effect.promise(() => readFile(path, "utf8"))).toBe(contents);
    }),
  ),
);
