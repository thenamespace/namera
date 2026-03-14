/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: safe */
import { Wallet } from "@ethereumjs/wallet";
import {
  Data,
  Effect,
  Layer,
  Option,
  Redacted,
  type Result,
  ServiceMap,
} from "effect";
import type { QuitError } from "effect/Terminal";
import { Prompt } from "effect/unstable/cli";
import type { Environment, SelectChoice } from "effect/unstable/cli/Prompt";
import type { Address } from "viem";
import { type LocalAccount, privateKeyToAccount } from "viem/accounts";

import type { IdentifierOrAlias } from "@/types";

import { AliasManager } from "./alias";
import { ConfigManager } from "./config";
import { PromptManager } from "./prompt";

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
    params: IdentifierOrAlias,
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
  selectKeystore: (params: {
    alias: Option.Option<string>;
    message: string;
  }) => Effect.Effect<Keystore, KeystoreError | QuitError, Environment>;
};

export const KeystoreManager =
  ServiceMap.Service<KeystoreManagerShape>("KeystoreManager");

export const KeystoreManagerLive = Layer.effect(
  KeystoreManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const aliasManager = yield* AliasManager;
    const promptManager = yield* PromptManager;

    const getKeystore = (params: IdentifierOrAlias) =>
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
            return yield* Effect.fail(new KeystoreError({ code: "NotFound" }));
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
          keystore: {
            ...keystore,
            address: `0x${keystore.address}` as Address,
          },
        };
      });

    const selectKeystore = (params: {
      alias: Option.Option<string>;
      message: string;
    }) =>
      Effect.gen(function* () {
        const keystores = yield* listKeystores();

        let res: Keystore;

        const keystorePrompt = Prompt.select({
          choices: keystores
            .map((v) => {
              if (v._op === "Failure") return null;
              const { alias, keystore } = v.success;
              const { address } = keystore;
              return {
                description: address,
                title: `${alias ? alias : address}`,
                value: v.success,
              };
            })
            .filter((k) => k !== null) satisfies SelectChoice<Keystore>[],
          message: params.message,
        });

        if (Option.isSome(params.alias)) {
          const id = yield* aliasManager.getIdentifier({
            alias: params.alias.value,
            type: "keystore",
          });

          if (id) {
            res = yield* getKeystore({ identifier: id });
          } else {
            res = yield* keystorePrompt;
          }
        } else {
          res = yield* keystorePrompt;
        }

        return res;
      });

    const listKeystores = () =>
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
                catch: () => new KeystoreError({ code: "KeystoreParseError" }),
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
      });

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
      getKeystore,
      getKeystoreSigner: (params) =>
        Effect.gen(function* () {
          const content = yield* configManager.getEntity({
            identifier: params.identifier,
            type: "keystore",
          });

          const password = yield* promptManager.selectPassword({
            message: "Enter password to unlock wallet: ",
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
      listKeystores,
      selectKeystore,
    });
  }),
);
