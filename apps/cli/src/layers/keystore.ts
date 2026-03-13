import { Wallet } from "@ethereumjs/wallet";
import { Data, Effect, Layer, Redacted, type Result, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import { Prompt } from "effect/unstable/cli";
import type { Environment } from "effect/unstable/cli/Prompt";
import type { Address } from "viem";
import { type LocalAccount, privateKeyToAccount } from "viem/accounts";

import { AliasManager } from "./alias";
import { ConfigManager } from "./config";

export class KeystoreError extends Data.TaggedError("KeystoreError")<{
  code: "NotFound" | "KeystoreParseError" | "InvalidPassword";
}> {}

export type V3Keystore = Awaited<
  ReturnType<Awaited<ReturnType<(typeof Wallet)["fromV3"]>>["toV3"]>
> & { address: Address };

export type Keystore = {
  alias: string | undefined;
  identifier: string;
  keystore: V3Keystore;
};

export type KeystoreManagerShape = {
  getKeystore: (
    params: { identifier: string } | { alias: string },
  ) => Effect.Effect<Keystore, KeystoreError>;
  getKeystoreSigner: (params: {
    identifier: string;
  }) => Effect.Effect<LocalAccount, KeystoreError | QuitError, Environment>;
  createKeystore: (params: {
    alias: string;
    identifier: string;
    content: string;
  }) => Effect.Effect<void, KeystoreError>;
  listKeystores: () => Effect.Effect<
    Result.Result<Keystore, KeystoreError>[],
    KeystoreError
  >;
};

export const KeystoreManager =
  ServiceMap.Service<KeystoreManagerShape>("KeystoreManager");

export const KeystoreManagerLive = Layer.effect(
  KeystoreManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const aliasManager = yield* AliasManager;

    return KeystoreManager.of({
      createKeystore: (params) =>
        Effect.gen(function* () {
          const { alias, identifier, content } = params;

          yield* configManager.addEntity({
            data: content,
            identifier,
            type: "keystore",
          });

          yield* aliasManager
            .setAlias({
              alias,
              identifier,
              type: "keystore",
            })
            .pipe(Effect.orDie);
        }),
      getKeystore: (params) =>
        Effect.gen(function* () {
          const { idToAlias } = yield* aliasManager.getAliasFile("keystore");
          let identifier: string;
          if ("identifier" in params) {
            identifier = params.identifier;
          } else {
            const id = yield* aliasManager.getIdentifier({
              alias: params.alias,
              type: "keystore",
            });

            if (!id)
              return yield* Effect.fail(
                new KeystoreError({ code: "NotFound" }),
              );
            identifier = id;
          }

          const content = yield* configManager.getEntity({
            identifier,
            type: "keystore",
          });

          const keystore = yield* Effect.try({
            catch: () => new KeystoreError({ code: "KeystoreParseError" }),
            try: () => JSON.parse(content) as V3Keystore,
          });

          return {
            alias: idToAlias.get(identifier),
            identifier,
            keystore: { ...keystore, address: `0x${keystore.address}` },
          };
        }),
      getKeystoreSigner: (params) =>
        Effect.gen(function* () {
          const content = yield* configManager.getEntity({
            identifier: params.identifier,
            type: "keystore",
          });

          const password = yield* Prompt.password({
            message: "Enter password to unlock wallet: ",
            validate: (value) =>
              Effect.gen(function* () {
                yield* Effect.tryPromise({
                  catch: () => "Invalid password",
                  try: () => Wallet.fromV3(content, value),
                });

                return value;
              }),
          });

          const res = yield* Effect.tryPromise({
            catch: () => new KeystoreError({ code: "InvalidPassword" }),
            try: () => Wallet.fromV3(content, Redacted.value(password)),
          });

          const signer = privateKeyToAccount(
            res.getPrivateKeyString(),
          ) as LocalAccount;

          return signer;
        }),
      listKeystores: () =>
        Effect.gen(function* () {
          const walletIdentifiers = yield* configManager.getEntitiesForType({
            type: "keystore",
          });

          const { idToAlias } = yield* aliasManager.getAliasFile("keystore");

          const res = yield* Effect.all(
            walletIdentifiers.map((identifier) =>
              Effect.gen(function* () {
                const content = yield* configManager.getEntity({
                  identifier,
                  type: "keystore",
                });

                const keystore = yield* Effect.try({
                  catch: () =>
                    new KeystoreError({ code: "KeystoreParseError" }),
                  try: () => JSON.parse(content) as V3Keystore,
                });

                return {
                  alias: idToAlias.get(identifier),
                  identifier,
                  keystore: { ...keystore, address: `0x${keystore.address}` },
                } as Keystore;
              }),
            ),
            { concurrency: "unbounded", mode: "result" },
          );

          return res;
        }),
    });
  }),
);
