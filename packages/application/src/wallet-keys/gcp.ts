import { createHash } from "node:crypto";

import { Effect, Layer } from "effect";

import { KeyManagementServiceClient } from "@google-cloud/kms";
import { WalletKeyError } from "@namera-ai/protocol";

import { GcpWalletKeysConfig } from "./config.js";
import type { CreateWalletKeyInput, SignWalletKeyInput } from "./data.js";
import { publicKeyHexFromPem } from "./helpers.js";
import { WalletKeys } from "./service.js";

const providerAlgorithm = "EC_SIGN_P256_SHA256";

export const GcpWalletKeysLayer = Layer.effect(
  WalletKeys,
  Effect.gen(function* () {
    const config = yield* GcpWalletKeysConfig;
    const client = yield* Effect.acquireRelease(
      Effect.sync(() => new KeyManagementServiceClient()),
      (kmsClient) => Effect.promise(() => kmsClient.close()).pipe(Effect.orDie),
    );
    const keyRingName = client.keyRingPath(config.projectId, config.location, config.keyRing);

    const create = Effect.fn("WalletKeys.gcp.create")(function* (input: CreateWalletKeyInput) {
      const [key] = yield* Effect.tryPromise({
        try: () =>
          client.createCryptoKey({
            parent: keyRingName,
            cryptoKeyId: `wallet-${input.id}`,
            cryptoKey: {
              purpose: "ASYMMETRIC_SIGN",
              versionTemplate: {
                algorithm: providerAlgorithm,
                protectionLevel: input.protectionLevel === "hsm" ? "HSM" : "SOFTWARE",
              },
            },
          }),
        catch: (cause) => new WalletKeyError({ operation: "create", cause }),
      });

      const cryptoKeyName = key.name;
      const keyVersionName = key.primary?.name;
      if (
        cryptoKeyName === null ||
        cryptoKeyName === undefined ||
        keyVersionName === null ||
        keyVersionName === undefined
      ) {
        return yield* new WalletKeyError({
          operation: "create",
          cause: new Error("Google Cloud KMS did not return the created key version"),
        });
      }

      const [publicKey] = yield* Effect.tryPromise({
        try: () => client.getPublicKey({ name: keyVersionName }),
        catch: (cause) => new WalletKeyError({ operation: "create", cause }),
      });
      if (publicKey.pem === null || publicKey.pem === undefined) {
        return yield* new WalletKeyError({
          operation: "create",
          cause: new Error("Google Cloud KMS did not return a public key"),
        });
      }

      const publicKeyHex = yield* publicKeyHexFromPem(publicKey.pem);

      return {
        provider: "gcp-kms",
        algorithm: "p256",
        protectionLevel: input.protectionLevel,
        keyVersionName,
        publicKeyHex,
        data: {
          version: 1,
          providerAlgorithm,
          cryptoKeyName,
        },
      } as const;
    });

    const sign = Effect.fn("WalletKeys.gcp.sign")(function* (input: SignWalletKeyInput) {
      const digest = createHash("sha256").update(input.payload).digest();
      const [response] = yield* Effect.tryPromise({
        try: () =>
          client.asymmetricSign({
            name: input.keyVersionName,
            digest: { sha256: digest },
          }),
        catch: (cause) => new WalletKeyError({ operation: "sign", cause }),
      });

      if (response.signature === null || response.signature === undefined) {
        return yield* new WalletKeyError({
          operation: "sign",
          cause: new Error("Google Cloud KMS did not return a signature"),
        });
      }

      return typeof response.signature === "string"
        ? new Uint8Array(Buffer.from(response.signature, "base64"))
        : new Uint8Array(response.signature);
    });

    return WalletKeys.of({ create, sign });
  }),
);
