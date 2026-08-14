import { createHash, sign as signPayload } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Effect, Schema, type Config } from "effect";

import { WalletKeyError } from "@namera-ai/protocol";
import type {
  CreateWalletKeyInput,
  DestroyWalletKeyInput,
  DisableWalletKeyInput,
  SignWalletKeyHashInput,
  SignWalletKeyMessageInput,
} from "@namera-ai/protocol/model";

import { LocalWalletKeysConfig } from "./config.js";
import { generateLocalKeyPair, publicKeyHexFromPem, signLocalHash } from "./helpers.js";
import type { WalletKeysService } from "./service.js";

const LocalKeyFile = Schema.Struct({
  version: Schema.Literal(1),
  algorithm: Schema.Literals(["p256", "ed25519", "secp256k1"]),
  privateKeyPem: Schema.NonEmptyString,
  status: Schema.Literals(["active", "disabled"]),
});

export const makeLocalWalletKeys: Effect.Effect<
  WalletKeysService,
  Config.ConfigError | WalletKeyError
> = Effect.gen(function* () {
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
            status: "active",
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
      publicKeyHex,
      data: { version: 1, fileName },
    } as const;
  });

  const readKey = Effect.fn("WalletKeys.local.readKey")(function* (
    fileName: string,
    operation: "sign" | "disable",
  ) {
    const encodedKey = yield* Effect.tryPromise({
      try: () => readFile(join(config.directory, fileName), "utf8"),
      catch: (cause) => new WalletKeyError({ operation, cause }),
    });
    return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(LocalKeyFile))(encodedKey).pipe(
      Effect.mapError((cause) => new WalletKeyError({ operation, cause })),
    );
  });

  const validateSigningKey = Effect.fn("WalletKeys.local.validateSigningKey")(function* (
    input: SignWalletKeyMessageInput | SignWalletKeyHashInput,
  ) {
    if (input.provider !== "local") {
      return yield* new WalletKeyError({
        operation: "sign",
        cause: new Error("Local wallet keys require local provider data"),
      });
    }

    const key = yield* readKey(input.data.fileName, "sign");

    if (key.algorithm !== input.algorithm) {
      return yield* new WalletKeyError({
        operation: "sign",
        cause: new Error("Wallet key algorithm does not match the stored key"),
      });
    }

    if (key.status !== "active") {
      return yield* new WalletKeyError({
        operation: "sign",
        cause: new Error("Wallet key is disabled"),
      });
    }

    return key;
  });

  const signMessage = Effect.fn("WalletKeys.local.signMessage")(function* (
    input: SignWalletKeyMessageInput,
  ) {
    const key = yield* validateSigningKey(input);

    if (key.algorithm !== "ed25519") {
      return yield* signLocalHash(
        key.privateKeyPem,
        key.algorithm,
        createHash("sha256").update(input.message).digest(),
      );
    }

    return yield* Effect.try({
      try: () => new Uint8Array(signPayload(null, input.message, key.privateKeyPem)),
      catch: (cause) => new WalletKeyError({ operation: "sign", cause }),
    });
  });

  const signHash = Effect.fn("WalletKeys.local.signHash")(function* (
    input: SignWalletKeyHashInput,
  ) {
    const key = yield* validateSigningKey(input);
    if (key.algorithm === "ed25519") {
      return yield* new WalletKeyError({
        operation: "sign",
        cause: new Error("Ed25519 does not support pre-hashed signing"),
      });
    }

    return yield* signLocalHash(key.privateKeyPem, key.algorithm, input.hash);
  });

  const disable = Effect.fn("WalletKeys.local.disable")(function* (input: DisableWalletKeyInput) {
    if (input.provider !== "local") {
      return yield* new WalletKeyError({
        operation: "disable",
        cause: new Error("Local wallet keys require local provider data"),
      });
    }

    const path = join(config.directory, input.data.fileName);
    const key = yield* readKey(input.data.fileName, "disable");

    yield* Effect.tryPromise({
      try: () =>
        writeFile(path, JSON.stringify({ ...key, status: "disabled" }), {
          encoding: "utf8",
          mode: 0o600,
        }),
      catch: (cause) => new WalletKeyError({ operation: "disable", cause }),
    });
  });

  const destroy = Effect.fn("WalletKeys.local.destroy")(function* (input: DestroyWalletKeyInput) {
    if (input.provider !== "local") {
      return yield* new WalletKeyError({
        operation: "destroy",
        cause: new Error("Local wallet keys require local provider data"),
      });
    }

    yield* Effect.tryPromise({
      try: () => rm(join(config.directory, input.data.fileName), { force: true }),
      catch: (cause) => new WalletKeyError({ operation: "destroy", cause }),
    });
  });

  return { create, signMessage, signHash, disable, destroy };
});
