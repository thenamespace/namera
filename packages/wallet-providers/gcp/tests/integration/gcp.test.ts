import { createHash, generateKeyPairSync } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Schema } from "effect";

import { crc32c } from "@aws-crypto/crc32c";
import { SigningKeyId } from "@namera-ai/protocol";
import { beforeEach, vi } from "vitest";

import { GcpService } from "../../src/index.js";

const sdk = vi.hoisted(() => ({
  createCryptoKey: vi.fn(),
  getPublicKey: vi.fn(),
  asymmetricSign: vi.fn(),
  updateCryptoKeyVersion: vi.fn(),
  destroyCryptoKeyVersion: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@google-cloud/kms", () => ({
  KeyManagementServiceClient: class {
    createCryptoKey = sdk.createCryptoKey;
    getPublicKey = sdk.getPublicKey;
    asymmetricSign = sdk.asymmetricSign;
    updateCryptoKeyVersion = sdk.updateCryptoKeyVersion;
    destroyCryptoKeyVersion = sdk.destroyCryptoKeyVersion;
    close = sdk.close;
    keyRingPath(project: string, location: string, ring: string) {
      return `projects/${project}/locations/${location}/keyRings/${ring}`;
    }
  },
}));

const id = Schema.decodeSync(SigningKeyId)("0198a6f0-0000-7000-8000-000000000001");
const name =
  "projects/test/locations/global/keyRings/test/cryptoKeys/wallet-test/cryptoKeyVersions/1";
const pem = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
  .publicKey.export({ type: "spki", format: "pem" })
  .toString();
const signature = new Uint8Array([48, 6, 2, 1, 1, 2, 1, 1]);
const data = {
  version: 1,
  providerAlgorithm: "EC_SIGN_P256_SHA256",
  keyVersionName: name,
} as const;
const publicResponse = () => ({ name, pem, pemCrc32c: { value: crc32c(Buffer.from(pem)) } });
const signatureResponse = () => ({
  name,
  signature,
  signatureCrc32c: { value: crc32c(signature) },
  verifiedDigestCrc32c: true,
  verifiedDataCrc32c: true,
});
const Live = GcpService.layer.pipe(
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({ GCP_PROJECT_ID: "test", GCP_KMS_KEY_RING: "test" }),
    ),
  ),
);

beforeEach(() => {
  vi.resetAllMocks();
  sdk.createCryptoKey.mockResolvedValue([{ primary: { name } }]);
  sdk.getPublicKey.mockResolvedValue([publicResponse()]);
  sdk.asymmetricSign.mockResolvedValue([signatureResponse()]);
  sdk.updateCryptoKeyVersion.mockResolvedValue([]);
  sdk.destroyCryptoKeyVersion.mockResolvedValue([]);
  sdk.close.mockResolvedValue(undefined);
});

it.effect("preserves KMS creation settings, key version and scoped cleanup", () =>
  Effect.gen(function* () {
    yield* Effect.gen(function* () {
      const gcp = yield* GcpService;
      const created = yield* gcp.createKey({ id, algorithm: "p256", protectionLevel: "hsm" });
      expect(created.data).toEqual(data);
      expect(sdk.createCryptoKey).toHaveBeenCalledWith({
        parent: "projects/test/locations/global/keyRings/test",
        cryptoKeyId: `wallet-${id}`,
        cryptoKey: {
          purpose: "ASYMMETRIC_SIGN",
          versionTemplate: { algorithm: "EC_SIGN_P256_SHA256", protectionLevel: "HSM" },
        },
      });
      yield* gcp.disableKey({ data });
      yield* gcp.destroyKey({ data });
      expect(sdk.updateCryptoKeyVersion).toHaveBeenCalledWith({
        cryptoKeyVersion: { name, state: "DISABLED" },
        updateMask: { paths: ["state"] },
      });
      expect(sdk.destroyCryptoKeyVersion).toHaveBeenCalledWith({ name });
    }).pipe(Effect.provide(Live));
    expect(sdk.close).toHaveBeenCalledTimes(1);
  }),
);

it.effect("sends exact digests and hashes ECDSA messages only once", () =>
  Effect.gen(function* () {
    const gcp = yield* GcpService;
    const hash = new Uint8Array(32).fill(7);
    expect(yield* gcp.signDigest({ algorithm: "p256", data, hash })).toEqual(signature);
    expect(sdk.asymmetricSign).toHaveBeenLastCalledWith({
      name,
      digest: { sha256: hash },
      digestCrc32c: { value: crc32c(hash) },
    });
    const message = new Uint8Array([1, 2, 3]);
    yield* gcp.signMessage({ algorithm: "p256", data, message });
    const digest = createHash("sha256").update(message).digest();
    expect(sdk.asymmetricSign).toHaveBeenLastCalledWith({
      name,
      digest: { sha256: digest },
      digestCrc32c: { value: crc32c(digest) },
    });
    yield* gcp.signMessage({
      algorithm: "ed25519",
      data: { ...data, providerAlgorithm: "EC_SIGN_ED25519" },
      message,
    });
    expect(sdk.asymmetricSign).toHaveBeenLastCalledWith({
      name,
      data: message,
      dataCrc32c: { value: crc32c(message) },
    });
  }).pipe(Effect.provide(Live)),
);

it.effect("rejects corrupted public keys, signing integrity and mismatched algorithms", () =>
  Effect.gen(function* () {
    const gcp = yield* GcpService;
    for (const response of [
      { ...publicResponse(), name: "different" },
      { ...publicResponse(), pemCrc32c: { value: 0 } },
    ]) {
      sdk.getPublicKey.mockResolvedValueOnce([response]);
      expect(
        yield* gcp
          .createKey({ id, algorithm: "p256", protectionLevel: "software" })
          .pipe(Effect.isFailure),
      ).toBe(true);
    }
    for (const response of [
      { ...signatureResponse(), name: "different" },
      { ...signatureResponse(), verifiedDigestCrc32c: false },
      { ...signatureResponse(), signatureCrc32c: { value: 0 } },
      { ...signatureResponse(), signature: undefined },
    ]) {
      sdk.asymmetricSign.mockResolvedValueOnce([response]);
      expect(
        yield* gcp
          .signDigest({ algorithm: "p256", data, hash: new Uint8Array(32) })
          .pipe(Effect.isFailure),
      ).toBe(true);
    }
    sdk.asymmetricSign.mockClear();
    expect(
      yield* gcp
        .signDigest({ algorithm: "secp256k1", data, hash: new Uint8Array(32) })
        .pipe(Effect.isFailure),
    ).toBe(true);
    expect(
      yield* gcp
        .signDigest({ algorithm: "p256", data, hash: new Uint8Array(31) })
        .pipe(Effect.isFailure),
    ).toBe(true);
    expect(sdk.asymmetricSign).not.toHaveBeenCalled();
  }).pipe(Effect.provide(Live)),
);
