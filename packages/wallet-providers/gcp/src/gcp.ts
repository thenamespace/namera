import { createHash } from "node:crypto";

import { Effect, Schema, type Config, type Scope } from "effect";

import { crc32c } from "@aws-crypto/crc32c";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import type { protos } from "@google-cloud/kms";

import { GcpConfig } from "#/config";
import { GcpKeyError } from "#/errors";
import { publicKeyHexFromPem } from "#/key-material";
import {
  CreateKeyInput,
  type KeyReference,
  SignDigestInput,
  type SignMessageInput,
} from "#/schemas";
import type { GcpOperations } from "#/service";

const providerAlgorithms = {
  p256: "EC_SIGN_P256_SHA256",
  ed25519: "EC_SIGN_ED25519",
  secp256k1: "EC_SIGN_SECP256K1_SHA256",
} as const;

const checksumValue = (value: { readonly value?: unknown } | null | undefined) =>
  value?.value === null || value?.value === undefined ? undefined : Number(value.value) >>> 0;

// KMS request and response CRCs are checked explicitly because a successful RPC
// alone does not prove the bytes received by either side were unchanged.
export const makeGcpService: Effect.Effect<
  GcpOperations,
  Config.ConfigError | GcpKeyError,
  Scope.Scope
> = Effect.gen(function* () {
  const config = yield* GcpConfig;
  const client = yield* Effect.acquireRelease(
    Effect.sync(() => new KeyManagementServiceClient()),
    (kmsClient) => Effect.promise(() => kmsClient.close()).pipe(Effect.orDie),
  );
  const keyRingName = client.keyRingPath(config.projectId, config.location, config.keyRing);

  const create = Effect.fn("wallet-providers.gcp.create")(function* (encoded: CreateKeyInput) {
    const input = yield* Schema.decodeUnknownEffect(CreateKeyInput)(encoded, {
      onExcessProperty: "error",
    }).pipe(Effect.mapError((cause) => new GcpKeyError({ operation: "create", cause })));
    const providerAlgorithm = providerAlgorithms[input.algorithm];
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
      catch: (cause) => new GcpKeyError({ operation: "create", cause }),
    });

    const keyVersionName = key.primary?.name;
    if (keyVersionName === null || keyVersionName === undefined) {
      return yield* new GcpKeyError({
        operation: "create",
        cause: new Error("Google Cloud KMS did not return the created key version"),
      });
    }

    const [publicKey] = yield* Effect.tryPromise({
      try: () => client.getPublicKey({ name: keyVersionName }),
      catch: (cause) => new GcpKeyError({ operation: "create", cause }),
    });
    if (publicKey.pem === null || publicKey.pem === undefined) {
      return yield* new GcpKeyError({
        operation: "create",
        cause: new Error("Google Cloud KMS did not return a public key"),
      });
    }
    const publicKeyChecksum = checksumValue(publicKey.pemCrc32c);
    if (
      publicKey.name !== keyVersionName ||
      publicKeyChecksum === undefined ||
      publicKeyChecksum !== crc32c(Buffer.from(publicKey.pem, "utf8"))
    ) {
      return yield* new GcpKeyError({
        operation: "create",
        cause: new Error("Google Cloud KMS public key integrity verification failed"),
      });
    }

    const publicKeyHex = yield* publicKeyHexFromPem(publicKey.pem, input.algorithm);

    return {
      algorithm: input.algorithm,
      protectionLevel: input.protectionLevel,
      publicKeyHex,
      data: {
        version: 1,
        providerAlgorithm,
        keyVersionName,
      },
    } as const;
  });

  const validateSigningInput = Effect.fnUntraced(function* (
    input: SignMessageInput | SignDigestInput,
  ) {
    if (input.data.providerAlgorithm !== providerAlgorithms[input.algorithm]) {
      return yield* new GcpKeyError({
        operation: "sign",
        cause: new Error("Wallet key algorithm does not match the stored GCP algorithm"),
      });
    }

    return input.data;
  });

  const validateSignature = Effect.fnUntraced(function* (
    response: protos.google.cloud.kms.v1.IAsymmetricSignResponse,
    keyVersionName: string,
    integrityVerified: boolean | null | undefined,
  ) {
    if (response.name !== keyVersionName || integrityVerified !== true) {
      return yield* new GcpKeyError({
        operation: "sign",
        cause: new Error("Google Cloud KMS did not verify the signing request integrity"),
      });
    }

    if (response.signature === null || response.signature === undefined) {
      return yield* new GcpKeyError({
        operation: "sign",
        cause: new Error("Google Cloud KMS did not return a signature"),
      });
    }

    const signature =
      typeof response.signature === "string"
        ? new Uint8Array(Buffer.from(response.signature, "base64"))
        : new Uint8Array(response.signature);
    const signatureChecksum = checksumValue(response.signatureCrc32c);
    if (signatureChecksum === undefined || signatureChecksum !== crc32c(signature)) {
      return yield* new GcpKeyError({
        operation: "sign",
        cause: new Error("Google Cloud KMS signature integrity verification failed"),
      });
    }

    return signature;
  });

  const kmsSignDigest = Effect.fnUntraced(function* (keyVersionName: string, hash: Uint8Array) {
    const [response] = yield* Effect.tryPromise({
      try: () =>
        client.asymmetricSign({
          name: keyVersionName,
          digest: { sha256: hash },
          digestCrc32c: { value: crc32c(hash) },
        }),
      catch: (cause) => new GcpKeyError({ operation: "sign", cause }),
    });

    return yield* validateSignature(response, keyVersionName, response.verifiedDigestCrc32c);
  });

  const signMessage = Effect.fn("wallet-providers.gcp.signMessage")(function* (
    input: SignMessageInput,
  ) {
    const data = yield* validateSigningInput(input);
    if (input.algorithm !== "ed25519") {
      return yield* kmsSignDigest(
        data.keyVersionName,
        createHash("sha256").update(input.message).digest(),
      );
    }

    const [response] = yield* Effect.tryPromise({
      try: () =>
        client.asymmetricSign({
          name: data.keyVersionName,
          data: input.message,
          dataCrc32c: { value: crc32c(input.message) },
        }),
      catch: (cause) => new GcpKeyError({ operation: "sign", cause }),
    });

    return yield* validateSignature(response, data.keyVersionName, response.verifiedDataCrc32c);
  });

  const signDigest = Effect.fn("wallet-providers.gcp.signDigest")(function* (
    encoded: SignDigestInput,
  ) {
    const input = yield* Schema.decodeUnknownEffect(SignDigestInput)(encoded).pipe(
      Effect.mapError((cause) => new GcpKeyError({ operation: "sign", cause })),
    );
    const data = yield* validateSigningInput(input);
    return yield* kmsSignDigest(data.keyVersionName, input.hash);
  });

  const disable = Effect.fn("wallet-providers.gcp.disable")(function* (input: KeyReference) {
    yield* Effect.tryPromise({
      try: () =>
        client.updateCryptoKeyVersion({
          cryptoKeyVersion: { name: input.data.keyVersionName, state: "DISABLED" },
          updateMask: { paths: ["state"] },
        }),
      catch: (cause) => new GcpKeyError({ operation: "disable", cause }),
    });
  });

  const destroy = Effect.fn("wallet-providers.gcp.destroy")(function* (input: KeyReference) {
    yield* Effect.tryPromise({
      try: () => client.destroyCryptoKeyVersion({ name: input.data.keyVersionName }),
      catch: (cause) => new GcpKeyError({ operation: "destroy", cause }),
    });
  });

  return { createKey: create, signMessage, signDigest, disableKey: disable, destroyKey: destroy };
});
