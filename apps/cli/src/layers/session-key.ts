/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: safe */

import { Wallet } from "@ethereumjs/wallet";
import {
  type BaseKernelAccountClient,
  createSessionKeyClient,
} from "@namera-ai/core";
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
import { type Address, createPublicClient, type Hex, http } from "viem";
import { type LocalAccount, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import type { PolicyDataType } from "@/domains/session-key/prompts/types";
import type { IdentifierOrAlias } from "@/types";

import { AliasManager } from "./alias";
import { ConfigManager } from "./config";
import type { V3Keystore } from "./keystore";
import { PromptManager } from "./prompt";

export class SessionKeyError extends Data.TaggedError("SessionKeyError")<{
  code:
    | "CreationFailed"
    | "NotFound"
    | "ParseError"
    | "KeyAlreadyExists"
    | "InvalidPassword"
    | "ClientCreationFailed";
}> {}

export type LocalSessionKey = {
  encSessionPrivateKey: V3Keystore;
  serializedAccount: string;
  serializedPlugin: {
    permissionId?: Hex;
    policies: PolicyDataType[];
  };
  sessionKeyAddress: Address;
  smartAccountIdentifier: string;
};
export type LocalSessionKeyData = {
  alias: string | undefined;
  identifier: string;
  data: LocalSessionKey;
};

export type SessionKeyManagerShape = {
  getSessionKey: (
    params: IdentifierOrAlias,
  ) => Effect.Effect<LocalSessionKeyData, SessionKeyError>;
  getSessionKeySigner: (
    params: IdentifierOrAlias & {
      message?: string;
    },
  ) => Effect.Effect<LocalAccount, SessionKeyError | QuitError, Environment>;
  getSessionKeyClient: (
    params: IdentifierOrAlias,
  ) => Effect.Effect<
    BaseKernelAccountClient,
    SessionKeyError | QuitError,
    Environment
  >;
  listSessionKeys: () => Effect.Effect<
    Result.Result<LocalSessionKeyData, SessionKeyError>[]
  >;
  storeSessionKey: (
    alias: string,
    params: LocalSessionKey,
  ) => Effect.Effect<void, SessionKeyError>;
  selectSessionKey: (params: {
    existingAlias: Option.Option<string>;
    message: string;
  }) => Effect.Effect<
    LocalSessionKeyData,
    QuitError | SessionKeyError,
    Environment
  >;
  multiSelectSessionKeys: (params: {
    message: string;
  }) => Effect.Effect<
    LocalSessionKeyData[],
    QuitError | SessionKeyError,
    Environment
  >;
};

export const SessionKeyManager =
  ServiceMap.Service<SessionKeyManagerShape>("SessionKeyManager");

export const SessionKeyManagerLive = Layer.effect(
  SessionKeyManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const aliasManager = yield* AliasManager;
    const promptManager = yield* PromptManager;

    const getSessionKey = (params: IdentifierOrAlias) =>
      Effect.gen(function* () {
        let identifier: string;
        if ("alias" in params) {
          const { aliasToId } = yield* aliasManager.getAliasFile("session-key");
          const id = aliasToId.get(params.alias);
          if (!id) {
            return yield* Effect.fail(
              new SessionKeyError({ code: "NotFound" }),
            );
          }

          identifier = id;
        } else {
          identifier = params.identifier;
        }
        const data = yield* configManager.getEntity({
          identifier,
          type: "session-key",
        });

        const parsed = yield* Effect.try({
          catch: () => new SessionKeyError({ code: "ParseError" }),
          try: () => JSON.parse(data) as LocalSessionKey,
        });

        const alias = yield* aliasManager.getAlias({
          identifier: identifier,
          type: "session-key",
        });

        return {
          alias,
          data: parsed,
          identifier: parsed.sessionKeyAddress,
        };
      });

    const listSessionKeys = () =>
      Effect.gen(function* () {
        const identifiers = yield* configManager.getEntitiesForType({
          type: "session-key",
        });

        const { idToAlias } = yield* aliasManager.getAliasFile("session-key");

        const data = yield* Effect.all(
          identifiers.map((identifier) =>
            Effect.gen(function* () {
              const data = yield* configManager.getEntity({
                identifier,
                type: "session-key",
              });

              const parsedData = yield* Effect.try({
                catch: () => new SessionKeyError({ code: "ParseError" }),
                try: () => JSON.parse(data) as LocalSessionKey,
              });

              const alias = idToAlias.get(identifier);

              return {
                alias,
                data: parsedData,
                identifier: parsedData.sessionKeyAddress,
              };
            }),
          ),
          { concurrency: "unbounded", mode: "result" },
        );
        return data;
      });

    const selectSessionKey = (params: {
      existingAlias: Option.Option<string>;
      message: string;
    }) =>
      Effect.gen(function* () {
        const keys = yield* listSessionKeys();

        let key: LocalSessionKeyData;

        const sessionKeyPrompt = Prompt.select({
          choices: keys
            .map((k) => {
              if (k._op === "Failure") return null;
              const { alias, identifier } = k.success;
              return {
                description: identifier,
                title: alias ?? identifier,
                value: k.success,
              };
            })
            .filter(
              (a) => a !== null,
            ) satisfies SelectChoice<LocalSessionKeyData>[],
          message: params.message,
        });

        if (Option.isSome(params.existingAlias)) {
          const id = yield* aliasManager.getIdentifier({
            alias: params.existingAlias.value,
            type: "session-key",
          });

          if (id) {
            key = yield* getSessionKey({ identifier: id });
          } else {
            key = yield* sessionKeyPrompt;
          }
        } else {
          key = yield* sessionKeyPrompt;
        }

        return key;
      });

    const multiSelectSessionKeys = (params: { message: string }) =>
      Effect.gen(function* () {
        const keys = yield* listSessionKeys();

        const selected = yield* Prompt.multiSelect({
          choices: keys
            .map((k) => {
              if (k._op === "Failure") return null;
              const { alias, identifier } = k.success;
              return {
                description: identifier,
                title: alias ?? identifier,
                value: k.success,
              };
            })
            .filter(
              (a) => a !== null,
            ) satisfies SelectChoice<LocalSessionKeyData>[],
          message: params.message,
        });

        return selected;
      });

    const getSessionKeySigner = (params: IdentifierOrAlias) =>
      Effect.gen(function* () {
        const key = yield* getSessionKey(params);

        const password = yield* promptManager.selectPassword({
          message: params.message ?? "Enter password to unlock session key: ",
          validate: (v) =>
            Effect.gen(function* () {
              yield* Effect.tryPromise({
                catch: () => "Invalid Password",
                try: () => Wallet.fromV3(key.data.encSessionPrivateKey, v),
              });

              return v;
            }),
        });

        const res = yield* Effect.tryPromise({
          catch: () => new SessionKeyError({ code: "InvalidPassword" }),
          try: () =>
            Wallet.fromV3(
              key.data.encSessionPrivateKey,
              Redacted.value(password),
            ),
        });

        const signer = privateKeyToAccount(
          res.getPrivateKeyString(),
        ) as LocalAccount;

        return signer;
      });

    const getSessionKeyClient = (params: IdentifierOrAlias) =>
      Effect.gen(function* () {
        const key = yield* getSessionKey(params);
        const sessionKeySigner = yield* getSessionKeySigner(params);

        const publicClient = createPublicClient({
          chain: sepolia,
          transport: http(),
        });

        const res = yield* Effect.tryPromise({
          catch: () => new SessionKeyError({ code: "ClientCreationFailed" }),
          try: () =>
            createSessionKeyClient({
              bundlerTransport: http(),
              chain: sepolia,
              client: publicClient,
              serializedAccount: key.data.serializedAccount,
              sessionKeySigner,
            }),
        });

        return res;
      });

    return SessionKeyManager.of({
      getSessionKey,
      getSessionKeyClient,
      getSessionKeySigner,
      listSessionKeys,
      multiSelectSessionKeys,
      selectSessionKey,
      storeSessionKey: (alias, params) =>
        Effect.gen(function* () {
          // Step 1: Ensure that no session key with the same address exists
          const exists = yield* configManager.checkEntityExists({
            identifier: params.sessionKeyAddress,
            type: "session-key",
          });

          if (exists) {
            return yield* Effect.fail(
              new SessionKeyError({ code: "KeyAlreadyExists" }),
            );
          }

          // Step 2: Store the account
          yield* configManager.addEntity({
            data: JSON.stringify(params),
            identifier: params.sessionKeyAddress,
            type: "session-key",
          });

          // Step 3: Store Alias
          yield* aliasManager
            .setAlias({
              alias,
              identifier: params.sessionKeyAddress,
              type: "session-key",
            })
            .pipe(Effect.orDie);
        }),
    });
  }),
);
