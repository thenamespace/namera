import { Wallet } from "@ethereumjs/wallet";
import {
  createSessionKey as createNameraSessionKey,
  isSessionKeyInstalled,
} from "@namera-ai/sdk/session-key";
import { Data, Effect, Layer, type Redacted, Schema, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import type { Prompt } from "effect/unstable/cli";
import { hexToBytes, toHex } from "viem";
import {
  generatePrivateKey,
  type LocalAccount,
  privateKeyToAccount,
} from "viem/accounts";

import {
  type CreateSessionKeyParams,
  type Keystore,
  SessionKey,
  type SessionKeyData,
} from "@/dto";
import { policyParamsToPolicies } from "@/helpers/policy";
import { chainIdToChainName } from "@/schema";

import type {
  GetSessionKeyParams,
  GetSessionKeyStatusParams,
  ListSessionKeysParams,
  RemoveSessionKeyParams,
} from "../dto/session-key";
import { ConfigManager, type ConfigManagerError } from "./config";
import { KeystoreManager, type KeystoreManagerError } from "./keystore";
import { PromptManager } from "./prompt";
import { SmartAccountManager } from "./smart-account";
import { Web3Service } from "./web3";

export type SessionKeyManager = {
  createSessionKey: (
    params: CreateSessionKeyParams,
  ) => Effect.Effect<
    SessionKeyData,
    SessionKeyManagerError | ConfigManagerError | KeystoreManagerError
  >;
  getSessionKey: (
    params: GetSessionKeyParams,
  ) => Effect.Effect<
    SessionKeyData,
    SessionKeyManagerError | ConfigManagerError
  >;
  listSessionKeys: (
    params: ListSessionKeysParams,
  ) => Effect.Effect<
    SessionKeyData[],
    ConfigManagerError | SessionKeyManagerError
  >;
  selectSessionKey: (params: {
    message: string;
  }) => Effect.Effect<
    SessionKeyData,
    ConfigManagerError | SessionKeyManagerError | QuitError,
    Prompt.Environment
  >;
  getSessionKeyStatus: (
    params: GetSessionKeyStatusParams,
  ) => Effect.Effect<
    boolean,
    ConfigManagerError | SessionKeyManagerError,
    never
  >;
  multiSelectSessionKeys: (params: {
    message: string;
    smartAccount?: string;
  }) => Effect.Effect<
    SessionKeyData[],
    ConfigManagerError | SessionKeyManagerError | QuitError,
    Prompt.Environment
  >;
  getSessionKeyPassword: (params: {
    alias: string;
    message: string;
  }) => Effect.Effect<
    Redacted.Redacted<string>,
    SessionKeyManagerError | ConfigManagerError | QuitError,
    Prompt.Environment
  >;
  getSessionKeySigner: (params: {
    alias: string;
    password: string;
  }) => Effect.Effect<
    SessionKeyData & { signer: LocalAccount },
    SessionKeyManagerError | ConfigManagerError | QuitError,
    never
  >;
  removeSessionKey: (params: {
    readonly alias: string;
  }) => Effect.Effect<void, SessionKeyManagerError | ConfigManagerError, never>;
};
export const SessionKeyManager = ServiceMap.Service<SessionKeyManager>(
  "@namera-ai/cli/SessionKeyManager",
);

export class SessionKeyManagerError extends Data.TaggedError(
  "@namera-ai/cli/SessionKeyManagerError",
)<{
  code:
    | "EncryptionError"
    | "SessionKeyAlreadyExists"
    | "SessionKeyParseError"
    | "DecryptError";
  message: string;
}> {}

export const layer = Layer.effect(
  SessionKeyManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const promptManager = yield* PromptManager;
    const keystoreManager = yield* KeystoreManager;
    const smartAccountManager = yield* SmartAccountManager;
    const web3Service = yield* Web3Service;

    const createSessionKey = (params: CreateSessionKeyParams) =>
      Effect.gen(function* () {
        const exists = yield* configManager.checkEntityExists({
          alias: params.alias,
          type: "session-key",
        });

        if (exists) {
          return yield* Effect.fail(
            new SessionKeyManagerError({
              code: "SessionKeyAlreadyExists",
              message: `Session key for alias ${params.alias} already exists`,
            }),
          );
        }

        const entityPath = yield* configManager.getEntityPath({
          alias: params.alias,
          type: "session-key",
        });

        const sa = yield* smartAccountManager.getSmartAccount({
          alias: params.smartAccountAlias,
        });

        const ownerSigner = yield* keystoreManager.getSigner({
          alias: sa.data.ownerAlias,
          password: params.ownerKeystorePassword,
        });
        const policies = policyParamsToPolicies(params.policyParams);

        const clients = yield* Effect.all(
          params.chains.map((chain) => web3Service.getPublicClient({ chain })),
          { concurrency: "unbounded" },
        );

        const sessionPrivateKey = generatePrivateKey();
        const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);

        const res = yield* Effect.promise(() =>
          createNameraSessionKey({
            type: "ecdsa",
            accountType: "ecdsa",
            sessionPrivateKey,
            clients,
            entrypointVersion: sa.data.entryPointVersion,
            kernelVersion: sa.data.kernelVersion,
            index: sa.data.index,
            signer: ownerSigner,
            policies,
          }),
        );

        // Encrypt Session Key
        const encData = (yield* Effect.tryPromise({
          try: () =>
            Wallet.fromPrivateKey(hexToBytes(sessionPrivateKey)).toV3(
              params.sessionKeyPassword,
            ),
          catch: () =>
            new SessionKeyManagerError({
              code: "EncryptionError",
              message: "Failed to encrypt session key",
            }),
        })) as Keystore;

        const data: SessionKey = {
          sessionKeyType: "ecdsa",
          serializedAccounts: res.serializedAccounts.map((a) => ({
            chain: chainIdToChainName(a.chainId),
            serializedAccount: a.serializedAccount,
          })),
          sessionKeyAddress: sessionKeyAccount.address,
          smartAccountAlias: sa.alias,
          ...encData,
        };

        yield* configManager.storeEntity({
          alias: params.alias,
          content: JSON.stringify(data),
          path: entityPath,
          type: "session-key",
        });

        return {
          alias: params.alias,
          data,
          path: entityPath,
        } satisfies SessionKeyData;
      });

    const getSessionKey = (params: GetSessionKeyParams) =>
      Effect.gen(function* () {
        const res = yield* configManager.getEntity({
          alias: params.alias,
          type: "session-key",
        });

        const parsed = Schema.decodeUnknownOption(
          Schema.fromJsonString(SessionKey),
        )(res.content);

        if (parsed._tag === "None") {
          return yield* Effect.fail(
            new SessionKeyManagerError({
              code: "SessionKeyParseError",
              message: "Unable to parse session key",
            }),
          );
        }

        const data: SessionKeyData = {
          alias: res.alias,
          data: parsed.value,
          path: res.path,
        };

        return data;
      });

    const listSessionKeys = (params: ListSessionKeysParams) =>
      Effect.gen(function* () {
        const res = yield* configManager.getEntitiesForType("session-key");

        const effects = res.map((entity) =>
          Effect.gen(function* () {
            const parsed = Schema.decodeUnknownOption(
              Schema.fromJsonString(SessionKey),
            )(entity.content);

            if (parsed._tag === "None") {
              return yield* Effect.fail(
                new SessionKeyManagerError({
                  code: "SessionKeyParseError",
                  message: "Unable to parse session key",
                }),
              );
            }

            const data: SessionKeyData = {
              alias: entity.alias,
              data: parsed.value,
              path: entity.path,
            };

            return data;
          }),
        );

        const allKeys = yield* Effect.all(effects, {
          concurrency: "unbounded",
        });
        // .map((d) => (d._op === "Success" ? d.success : undefined))
        // .filter(Boolean) as SessionKeyData[];

        if (params.smartAccount) {
          return allKeys.filter(
            (k) => k.data.smartAccountAlias === params.smartAccount,
          );
        }

        return allKeys;
      });

    const selectSessionKey = (params: { message: string }) =>
      Effect.gen(function* () {
        const sessionKeys = yield* listSessionKeys({});

        const res = yield* promptManager.selectPrompt({
          message: params.message,
          choices: sessionKeys.map((sk) => ({
            title: sk.alias,
            value: sk,
            description: `${sk.data.sessionKeyType === "ecdsa" ? sk.data.sessionKeyAddress : sk.data.passKeyName} (${sk.data.smartAccountAlias})`,
          })) satisfies Prompt.SelectChoice<SessionKeyData>[],
        });

        return res;
      });

    const getSessionKeyStatus = (params: GetSessionKeyStatusParams) =>
      Effect.gen(function* () {
        const sessionKey = yield* getSessionKey({ alias: params.alias });
        const sa = yield* smartAccountManager.getSmartAccount({
          alias: sessionKey.data.smartAccountAlias,
        });

        const publicClient = yield* web3Service.getPublicClient({
          chain: params.chain,
          rpcUrl: params.rpcUrl,
        });

        if (sessionKey.data.sessionKeyType !== "ecdsa") {
          return yield* Effect.fail(
            new SessionKeyManagerError({
              code: "SessionKeyParseError",
              message: "Only ECDSA session keys have an on-chain status",
            }),
          );
        }
        const sessionKeyAddress = sessionKey.data.sessionKeyAddress;

        const res = yield* Effect.tryPromise({
          try: () =>
            isSessionKeyInstalled(publicClient, {
              accountAddress: sa.data.smartAccountAddress,
              sessionKeyAddress,
            }),
          catch: () => false,
        }).pipe(Effect.catch(() => Effect.succeed(false)));

        return res;
      });

    const multiSelectSessionKeys = (params: {
      message: string;
      smartAccount?: string;
    }) =>
      Effect.gen(function* () {
        const allKeys = yield* listSessionKeys({
          smartAccount: params.smartAccount,
        });

        const res = yield* promptManager.multiSelectPrompt({
          message: params.message,
          choices: allKeys.map((k) => ({
            title: k.alias,
            value: k,
            description: `${k.data.sessionKeyType === "ecdsa" ? k.data.sessionKeyAddress : k.data.passKeyName} (${k.data.smartAccountAlias})`,
          })) satisfies Prompt.SelectChoice<SessionKeyData>[],
          min: 1,
        });

        return res;
      });

    const getSessionKeyPassword = (params: {
      alias: string;
      message: string;
    }) =>
      Effect.gen(function* () {
        const key = yield* getSessionKey({ alias: params.alias });

        const password = yield* promptManager.passwordPrompt({
          message: params.message,
          validate: (v) =>
            Effect.gen(function* () {
              if (v.trim() === "") {
                return yield* Effect.fail("Password cannot be empty");
              }

              yield* Effect.tryPromise({
                try: () => Wallet.fromV3(key.data, v),
                catch: () =>
                  new SessionKeyManagerError({
                    code: "DecryptError",
                    message: `Invalid password for session key ${params.alias}`,
                  }),
              }).pipe(Effect.catch(() => Effect.fail("Invalid password")));

              return v;
            }),
        });

        return password;
      });

    const getSessionKeySigner = (params: { alias: string; password: string }) =>
      Effect.gen(function* () {
        const key = yield* getSessionKey({ alias: params.alias });

        const signer = yield* Effect.tryPromise({
          try: async () => {
            const wallet = await Wallet.fromV3(key.data, params.password);
            return privateKeyToAccount(
              toHex(wallet.getPrivateKey()),
            ) as LocalAccount;
          },
          catch: () =>
            new SessionKeyManagerError({
              code: "DecryptError",
              message: `Invalid password for session key ${params.alias}`,
            }),
        });

        return { ...key, signer };
      });

    const removeSessionKey = (params: RemoveSessionKeyParams) =>
      Effect.gen(function* () {
        const key = yield* getSessionKey({ alias: params.alias });

        return yield* configManager.removeEntity({
          alias: key.alias,
          type: "session-key",
        });
      });

    return SessionKeyManager.of({
      createSessionKey,
      getSessionKey,
      listSessionKeys,
      selectSessionKey,
      getSessionKeyStatus,
      multiSelectSessionKeys,
      getSessionKeyPassword,
      getSessionKeySigner,
      removeSessionKey,
    });
  }),
);
