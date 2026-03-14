import { Data, Effect, Layer, Option, type Result, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import { Prompt } from "effect/unstable/cli";
import type { Environment, SelectChoice } from "effect/unstable/cli/Prompt";
import type { Address, Hex } from "viem";

import type { PolicyDataType } from "@/domains/session-key/prompts/types";
import type { IdentifierOrAlias } from "@/types";

import { AliasManager } from "./alias";
import { ConfigManager } from "./config";
import type { V3Keystore } from "./keystore";

export class SessionKeyError extends Data.TaggedError("SessionKeyError")<{
  code: "CreationFailed" | "NotFound" | "ParseError" | "KeyAlreadyExists";
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
};

export const SessionKeyManager =
  ServiceMap.Service<SessionKeyManagerShape>("SessionKeyManager");

export const SessionKeyManagerLive = Layer.effect(
  SessionKeyManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const aliasManager = yield* AliasManager;

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
                type: "account",
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

    return SessionKeyManager.of({
      getSessionKey,
      listSessionKeys,
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
