import { createHash, sign as signPayload } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Effect, Schema, type Config } from "effect";

import { LocalConfig } from "#/config";
import { LocalKeyError } from "#/errors";
import { generateLocalKeyPair, publicKeyHexFromPem, signLocalHash } from "#/key-material";
import {
  CreateKeyInput,
  type KeyReference,
  SignDigestInput,
  type SignMessageInput,
} from "#/schemas";
import type { LocalOperations } from "#/service";

const LocalKeyFile = Schema.Struct({
  version: Schema.Literal(1),
  algorithm: Schema.Literals(["p256", "ed25519", "secp256k1"]),
  privateKeyPem: Schema.NonEmptyString,
  status: Schema.Literals(["active", "disabled"]),
});

export const makeLocalService: Effect.Effect<LocalOperations, Config.ConfigError | LocalKeyError> =
  Effect.gen(function* () {
    const config = yield* LocalConfig;

    yield* Effect.tryPromise({
      try: () => mkdir(config.directory, { recursive: true, mode: 0o700 }),
      catch: (cause) => new LocalKeyError({ operation: "create", cause }),
    });

    const create = Effect.fn("wallet-providers.local.create")(function* (encoded: CreateKeyInput) {
      const input = yield* Schema.decodeUnknownEffect(CreateKeyInput)(encoded, {
        onExcessProperty: "error",
      }).pipe(Effect.mapError((cause) => new LocalKeyError({ operation: "create", cause })));
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
        catch: (cause) => new LocalKeyError({ operation: "create", cause }),
      });

      const publicKeyHex = yield* publicKeyHexFromPem(keyPair.publicKey, input.algorithm);

      return {
        algorithm: input.algorithm,
        protectionLevel: input.protectionLevel,
        publicKeyHex,
        data: { version: 1, fileName },
      } as const;
    });

    const readKey = Effect.fnUntraced(function* (fileName: string, operation: "sign" | "disable") {
      const encodedKey = yield* Effect.tryPromise({
        try: () => readFile(join(config.directory, fileName), "utf8"),
        catch: (cause) => new LocalKeyError({ operation, cause }),
      });
      return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(LocalKeyFile))(
        encodedKey,
      ).pipe(Effect.mapError((cause) => new LocalKeyError({ operation, cause })));
    });

    const validateSigningKey = Effect.fnUntraced(function* (
      input: SignMessageInput | SignDigestInput,
    ) {
      const key = yield* readKey(input.data.fileName, "sign");

      if (key.algorithm !== input.algorithm) {
        return yield* new LocalKeyError({
          operation: "sign",
          cause: new Error("Wallet key algorithm does not match the stored key"),
        });
      }

      if (key.status !== "active") {
        return yield* new LocalKeyError({
          operation: "sign",
          cause: new Error("Wallet key is disabled"),
        });
      }

      return key;
    });

    const signMessage = Effect.fn("wallet-providers.local.signMessage")(function* (
      input: SignMessageInput,
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
        catch: (cause) => new LocalKeyError({ operation: "sign", cause }),
      });
    });

    const signDigest = Effect.fn("wallet-providers.local.signDigest")(function* (
      encoded: SignDigestInput,
    ) {
      const input = yield* Schema.decodeUnknownEffect(SignDigestInput)(encoded).pipe(
        Effect.mapError((cause) => new LocalKeyError({ operation: "sign", cause })),
      );
      const key = yield* validateSigningKey(input);
      if (key.algorithm === "ed25519") {
        return yield* new LocalKeyError({
          operation: "sign",
          cause: new Error("Ed25519 does not support pre-hashed signing"),
        });
      }

      return yield* signLocalHash(key.privateKeyPem, key.algorithm, input.hash);
    });

    const disable = Effect.fn("wallet-providers.local.disable")(function* (input: KeyReference) {
      const path = join(config.directory, input.data.fileName);
      const key = yield* readKey(input.data.fileName, "disable");

      yield* Effect.tryPromise({
        try: () =>
          writeFile(path, JSON.stringify({ ...key, status: "disabled" }), {
            encoding: "utf8",
            mode: 0o600,
          }),
        catch: (cause) => new LocalKeyError({ operation: "disable", cause }),
      });
    });

    const destroy = Effect.fn("wallet-providers.local.destroy")(function* (input: KeyReference) {
      yield* Effect.tryPromise({
        try: () => rm(join(config.directory, input.data.fileName), { force: true }),
        catch: (cause) => new LocalKeyError({ operation: "destroy", cause }),
      });
    });

    return { createKey: create, signMessage, signDigest, disableKey: disable, destroyKey: destroy };
  });
