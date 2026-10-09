import { createHash, createPublicKey, verify } from "node:crypto";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Schema } from "effect";

import { SigningKeyId } from "@namera-ai/protocol";
import { CreateWalletKeyInput } from "@namera-ai/protocol/model";
import { p256 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";

import { WalletKeys } from "../../src/index.js";

const signingKeyIds = {
  p256: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000001"),
  ed25519: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000002"),
  secp256k1: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000003"),
  disabled: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000004"),
  destroyed: Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000005"),
} as const;

const withLocalWalletKeys = <A, E>(
  makeEffect: (directory: string) => Effect.Effect<A, E, WalletKeys>,
) =>
  Effect.acquireUseRelease(
    Effect.promise(() => mkdtemp(join(tmpdir(), "namera-wallet-keys-"))),
    (directory) =>
      makeEffect(directory).pipe(
        Effect.provide(
          WalletKeys.devLayer.pipe(
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

const createLocalKey = Effect.fn("wallet-keys.test.createLocalKey")(function* (
  input: CreateWalletKeyInput,
) {
  const walletKeys = yield* WalletKeys;
  const key = yield* walletKeys.create(input);
  if (key.provider !== "local") {
    return yield* Effect.die(new Error("The local layer returned a non-local wallet key"));
  }
  return key;
});

const readPrivateKey = Effect.fn("wallet-keys.test.readPrivateKey")(function* (
  directory: string,
  fileName: string,
) {
  const encoded = yield* Effect.promise(() => readFile(join(directory, fileName), "utf8"));
  return (JSON.parse(encoded) as { readonly privateKeyPem: string }).privateKeyPem;
});

it.effect("rejects 1Claw creation without creating local key material", () =>
  withLocalWalletKeys((directory) =>
    Effect.gen(function* () {
      const walletKeys = yield* WalletKeys;
      const input = Schema.decodeUnknownSync(CreateWalletKeyInput)({
        id: signingKeyIds.secp256k1,
        organizationId: "0198a6f0-0000-7000-8000-000000000006",
        credentialId: "0198a6f0-0000-7000-8000-000000000007",
        provider: "1claw",
        chain: "ethereum",
        algorithm: "secp256k1",
      });
      const error = yield* walletKeys.create(input).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "WalletKeyError", code: "UNSUPPORTED_OPERATION" });
      expect(yield* Effect.promise(() => readdir(directory))).toEqual([]);
    }),
  ),
);

it.effect("creates keys and signs messages with each supported algorithm", () =>
  withLocalWalletKeys((directory) =>
    Effect.gen(function* () {
      const walletKeys = yield* WalletKeys;
      const message = new TextEncoder().encode("namera local wallet key lifecycle");
      const inputs = [
        { id: signingKeyIds.p256, algorithm: "p256", protectionLevel: "software" },
        { id: signingKeyIds.ed25519, algorithm: "ed25519", protectionLevel: "software" },
        { id: signingKeyIds.secp256k1, algorithm: "secp256k1", protectionLevel: "hsm" },
      ] as const;

      for (const input of inputs) {
        const key = yield* createLocalKey(input);
        const signature = yield* walletKeys.signMessage({
          provider: "local",
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
  withLocalWalletKeys(() =>
    Effect.gen(function* () {
      const walletKeys = yield* WalletKeys;
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
        const key = yield* createLocalKey(input);
        const signature = yield* walletKeys.signHash({
          provider: "local",
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
  withLocalWalletKeys(() =>
    Effect.gen(function* () {
      const walletKeys = yield* WalletKeys;
      const key = yield* createLocalKey({
        id: signingKeyIds.disabled,
        algorithm: "p256",
        protectionLevel: "software",
      });

      yield* walletKeys.disable({ provider: "local", data: key.data });
      const error = yield* walletKeys
        .signMessage({
          provider: "local",
          algorithm: "p256",
          data: key.data,
          message: new Uint8Array([1]),
        })
        .pipe(Effect.flip);

      expect(error).toMatchObject({ _tag: "WalletKeyError", operation: "sign" });
    }),
  ),
);

it.effect("destroys local key material", () =>
  withLocalWalletKeys((directory) =>
    Effect.gen(function* () {
      const walletKeys = yield* WalletKeys;
      const key = yield* createLocalKey({
        id: signingKeyIds.destroyed,
        algorithm: "ed25519",
        protectionLevel: "software",
      });
      const path = join(directory, key.data.fileName);

      yield* walletKeys.destroy({ provider: "local", data: key.data });
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
