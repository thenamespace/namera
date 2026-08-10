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
  privateKeyPem: Schema.NonEmptyString,
});

const generateLocalKeyPair = Effect.tryPromise({
  try: () =>
    new Promise<{ readonly privateKey: string; readonly publicKey: string }>((resolve, reject) => {
      generateKeyPair(
        "ec",
        {
          namedCurve: "prime256v1",
          publicKeyEncoding: { type: "spki", format: "pem" },
          privateKeyEncoding: { type: "pkcs8", format: "pem" },
        },
        (error, publicKey, privateKey) => {
          if (error !== null) {
            reject(error);
            return;
          }

          resolve({ publicKey, privateKey });
        },
      );
    }),
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
      if (input.protectionLevel !== "software") {
        return yield* new WalletKeyError({
          operation: "create",
          cause: new Error("The local wallet key provider only supports software keys"),
        });
      }

      const keyPair = yield* generateLocalKeyPair;
      const fileName = `${input.id}.json`;

      yield* Effect.tryPromise({
        try: () =>
          writeFile(
            join(config.directory, fileName),
            JSON.stringify({ version: 1, privateKeyPem: keyPair.privateKey }),
            { encoding: "utf8", flag: "wx", mode: 0o600 },
          ),
        catch: (cause) => new WalletKeyError({ operation: "create", cause }),
      });

      const publicKeyHex = yield* publicKeyHexFromPem(keyPair.publicKey);

      return {
        provider: "local",
        algorithm: "p256",
        protectionLevel: "software",
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

      const signature = yield* Effect.try({
        try: () =>
          signPayload("sha256", input.payload, {
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
