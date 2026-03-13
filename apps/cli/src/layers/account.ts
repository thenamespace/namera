import { Data, Effect, Layer, type Result, Schema, ServiceMap } from "effect";

import { type LocalSmartAccount, LocalSmartAccountFromString } from "@/schema";
import type { IdentifierOrAlias } from "@/types";

import { AliasManager } from "./alias";
import { ConfigManager } from "./config";

export class AccountError extends Data.TaggedError("AccountError")<{
  code: "AliasNotFound" | "AccountAlreadyExists";
}> {}

export type LocalSmartAccountData = {
  alias: string | undefined;
  identifier: string;
  data: LocalSmartAccount;
};

export type AccountManagerShape = {
  getAccount: (
    params: IdentifierOrAlias,
  ) => Effect.Effect<LocalSmartAccountData, AccountError>;
  listAccounts: () => Effect.Effect<
    Result.Result<LocalSmartAccountData, AccountError>[]
  >;
  storeAccount: (
    alias: string,
    params: LocalSmartAccount,
  ) => Effect.Effect<void, AccountError>;
};

export const AccountManager =
  ServiceMap.Service<AccountManagerShape>("AccountManager");

export const AccountManagerLive = Layer.effect(
  AccountManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const aliasManager = yield* AliasManager;

    return AccountManager.of({
      getAccount: (params) =>
        Effect.gen(function* () {
          let identifier: string;
          if ("alias" in params) {
            const { aliasToId } = yield* aliasManager.getAliasFile("account");
            const id = aliasToId.get(params.alias);
            if (!id) {
              return yield* Effect.fail(
                new AccountError({ code: "AliasNotFound" }),
              );
            }

            identifier = id;
          } else {
            identifier = params.identifier;
          }
          const data = yield* configManager.getEntity({
            identifier,
            type: "account",
          });

          const parsed = Schema.decodeSync(LocalSmartAccountFromString)(data);

          const alias = yield* aliasManager.getAlias({
            identifier: identifier,
            type: "account",
          });

          return {
            alias,
            data: parsed,
            identifier: parsed.smartAccountAddress,
          };
        }),
      listAccounts: () =>
        Effect.gen(function* () {
          const identifiers = yield* configManager.getEntitiesForType({
            type: "account",
          });

          const { idToAlias } = yield* aliasManager.getAliasFile("account");

          const data = yield* Effect.all(
            identifiers.map((identifier) =>
              Effect.gen(function* () {
                const data = yield* configManager.getEntity({
                  identifier,
                  type: "account",
                });

                const parsedData = Schema.decodeSync(
                  LocalSmartAccountFromString,
                )(data);
                const alias = idToAlias.get(identifier);

                return {
                  alias,
                  data: parsedData,
                  identifier: parsedData.smartAccountAddress,
                };
              }),
            ),
            { concurrency: "unbounded", mode: "result" },
          );
          return data;
        }),
      storeAccount: (alias, params) =>
        Effect.gen(function* () {
          // Step 1: Ensure that no account with the same address exists
          const exists = yield* configManager.checkEntityExists({
            identifier: params.smartAccountAddress,
            type: "account",
          });

          if (exists) {
            return yield* Effect.fail(
              new AccountError({ code: "AccountAlreadyExists" }),
            );
          }

          // Step 2: Store the account
          yield* configManager.addEntity({
            data: Schema.encodeSync(LocalSmartAccountFromString)(params),
            identifier: params.smartAccountAddress,
            type: "account",
          });

          // Step 3: Store Alias
          yield* aliasManager
            .setAlias({
              alias,
              identifier: params.smartAccountAddress,
              type: "account",
            })
            .pipe(Effect.orDie);
        }),
    });
  }),
);
