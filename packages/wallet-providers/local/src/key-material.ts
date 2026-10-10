import { createPrivateKey, createPublicKey, generateKeyPair } from "node:crypto";

import { Effect, Schema } from "effect";

import { Hex } from "@namera-ai/protocol";
import { p256 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";

import { LocalKeyError } from "#/errors";
import type { CreateKeyInput } from "#/schemas";

export const generateLocalKeyPair = Effect.fnUntraced(function* (
  algorithm: CreateKeyInput["algorithm"],
) {
  return yield* Effect.tryPromise({
    try: () =>
      new Promise<{ readonly privateKey: string; readonly publicKey: string }>(
        (resolve, reject) => {
          const onGenerated = (error: Error | null, publicKey: string, privateKey: string) => {
            if (error !== null) {
              reject(error);
              return;
            }

            resolve({ publicKey, privateKey });
          };

          if (algorithm === "ed25519") {
            generateKeyPair(
              "ed25519",
              {
                publicKeyEncoding: { type: "spki", format: "pem" },
                privateKeyEncoding: { type: "pkcs8", format: "pem" },
              },
              onGenerated,
            );
            return;
          }

          generateKeyPair(
            "ec",
            {
              namedCurve: algorithm === "p256" ? "prime256v1" : "secp256k1",
              publicKeyEncoding: { type: "spki", format: "pem" },
              privateKeyEncoding: { type: "pkcs8", format: "pem" },
            },
            onGenerated,
          );
        },
      ),
    catch: (cause) => new LocalKeyError({ operation: "create", cause }),
  });
});

export const signLocalHash = Effect.fnUntraced(function* (
  privateKeyPem: string,
  algorithm: "p256" | "secp256k1",
  hash: Uint8Array,
) {
  const privateKey = yield* Effect.try({
    try: () => createPrivateKey(privateKeyPem).export({ format: "jwk" }),
    catch: (cause) => new LocalKeyError({ operation: "sign", cause }),
  });

  if (privateKey.d === undefined) {
    return yield* new LocalKeyError({
      operation: "sign",
      cause: new Error("Private key material is missing"),
    });
  }

  const privateKeyBytes = Buffer.from(privateKey.d, "base64url");
  return yield* Effect.try({
    try: () =>
      (algorithm === "p256" ? p256 : secp256k1).sign(hash, privateKeyBytes, {
        lowS: true,
        extraEntropy: true,
        prehash: false,
        format: "der",
      }),
    catch: (cause) => new LocalKeyError({ operation: "sign", cause }),
  });
});

export const publicKeyHexFromPem = Effect.fnUntraced(function* (
  pem: string,
  algorithm: CreateKeyInput["algorithm"],
) {
  const jwk = yield* Effect.try({
    try: () => createPublicKey(pem).export({ format: "jwk" }),
    catch: (cause) => new LocalKeyError({ operation: "create", cause }),
  });

  if (jwk.x === undefined) {
    return yield* new LocalKeyError({
      operation: "create",
      cause: new Error("Public key coordinates are missing"),
    });
  }

  const x = Buffer.from(jwk.x, "base64url").toString("hex");
  if (algorithm === "ed25519") {
    return yield* Schema.decodeUnknownEffect(Hex)(`0x${x}`).pipe(
      Effect.mapError((cause) => new LocalKeyError({ operation: "create", cause })),
    );
  }

  if (jwk.y === undefined) {
    return yield* new LocalKeyError({
      operation: "create",
      cause: new Error("Public key coordinates are missing"),
    });
  }

  const value = `0x04${x}${Buffer.from(jwk.y, "base64url").toString("hex")}`;

  return yield* Schema.decodeUnknownEffect(Hex)(value).pipe(
    Effect.mapError((cause) => new LocalKeyError({ operation: "create", cause })),
  );
});
