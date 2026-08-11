import { generateKeyPair, sign as signPayload } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Effect, Layer, Schema } from "effect";

import { WalletKeyError } from "@namera-ai/protocol";

import { LocalWalletKeysConfig } from "./config.js";
import type { CreateWalletKeyInput, SignWalletKeyInput } from "./data.js";
import { publicKeyHexFromPem } from "./helpers.js";
import { WalletKeys } from "./service.js";

const LocalKeyFile = Schema.Struct({
  version: Schema.Literal(1),
  algorithm: Schema.Literals(["p256", "ed25519", "secp256k1"]),
  privateKeyPem: Schema.NonEmptyString,
});

const generateLocalKeyPair = (algorithm: CreateWalletKeyInput["algorithm"]) =>
  Effect.tryPromise({
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
    catch: (cause) => new WalletKeyError({ operation: "create", cause }),
  });

export const LocalWalletKeysLayer = Layer.effect(
  WalletKeys,
  Effect.gen(function* () {
    const config = yield* LocalWalletKeysConfig;

    yield* Effect.tryPromise({
      try: () => mkdir(config.directory, { recursive: true, mode: 0o700 }),
      catch: (cause) => new WalletKeyError({ operation: "create", cause }),
    });

    const create = Effect.fn("WalletKeys.local.create")(function* (input: CreateWalletKeyInput) {
      const keyPair = yield* generateLocalKeyPair(input.algorithm);
      const fileName = `${input.id}.json`;

      yield* Effect.tryPromise({
        try: () =>
          writeFile(
            join(config.directory, fileName),
            JSON.stringify({
              version: 1,
              algorithm: input.algorithm,
              privateKeyPem: keyPair.privateKey,
            }),
            { encoding: "utf8", flag: "wx", mode: 0o600 },
          ),
        catch: (cause) => new WalletKeyError({ operation: "create", cause }),
      });

      const publicKeyHex = yield* publicKeyHexFromPem(keyPair.publicKey, input.algorithm);

      return {
        provider: "local",
        algorithm: input.algorithm,
        protectionLevel: input.protectionLevel,
        keyVersionName: input.id,
        publicKeyHex,
        data: { version: 1, fileName },
      } as const;
    });

    const sign = Effect.fn("WalletKeys.local.sign")(function* (input: SignWalletKeyInput) {
      const encodedKey = yield* Effect.tryPromise({
        try: () => readFile(join(config.directory, `${input.keyVersionName}.json`), "utf8"),
        catch: (cause) => new WalletKeyError({ operation: "sign", cause }),
      });
      const key = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(LocalKeyFile))(
        encodedKey,
      ).pipe(Effect.mapError((cause) => new WalletKeyError({ operation: "sign", cause })));

      if (key.algorithm !== input.algorithm) {
        return yield* new WalletKeyError({
          operation: "sign",
          cause: new Error("Wallet key algorithm does not match the stored key"),
        });
      }

      const signature = yield* Effect.try({
        try: () =>
          key.algorithm === "ed25519"
            ? signPayload(null, input.payload, key.privateKeyPem)
            : signPayload("sha256", input.payload, {
                key: key.privateKeyPem,
                dsaEncoding: "der",
              }),
        catch: (cause) => new WalletKeyError({ operation: "sign", cause }),
      });

      return new Uint8Array(signature);
    });

    return WalletKeys.of({ create, sign });
  }),
);
