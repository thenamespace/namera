import { Wallet } from "@ethereumjs/wallet";
import { createEcdsaSessionKey } from "@namera-ai/core/session-key";
import { Data, Effect, Layer, ServiceMap } from "effect";
import { hexToBytes } from "viem";

import type {
  CreateSessionKeyParams,
  Keystore,
  SessionKey,
  SessionKeyData,
} from "@/dto";
import { policyParamsToPolicies } from "@/helpers/policy";
import { chainIdToChainName } from "@/schema";

import { ConfigManager, type ConfigManagerError } from "./config";
import { KeystoreManager, type KeystoreManagerError } from "./keystore";
import { SmartAccountManager } from "./smart-account";
import { Web3Service } from "./web3";

export type SessionKeyManager = {
  createSessionKey: (
    params: CreateSessionKeyParams,
  ) => Effect.Effect<
    SessionKeyData,
    SessionKeyManagerError | ConfigManagerError | KeystoreManagerError
  >;
};
export const SessionKeyManager = ServiceMap.Service<SessionKeyManager>(
  "@namera-ai/cli/SessionKeyManager",
);

export class SessionKeyManagerError extends Data.TaggedError(
  "@namera-ai/cli/SessionKeyManagerError",
)<{
  code: "EncryptionError" | "SessionKeyAlreadyExists";
  message: string;
}> {}

export const layer = Layer.effect(
  SessionKeyManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
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

        const res = yield* Effect.promise(() =>
          createEcdsaSessionKey({
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
            Wallet.fromPrivateKey(hexToBytes(res.sessionPrivateKey)).toV3(
              params.sessionKeyPassword,
            ),
          catch: () =>
            new SessionKeyManagerError({
              code: "EncryptionError",
              message: "Failed to encrypt session key",
            }),
        })) as Keystore;

        const data: SessionKey = {
          serializedAccounts: res.serializedAccounts.map((a) => ({
            chain: chainIdToChainName(a.chainId),
            serializedAccount: a.serializedAccount,
          })),
          sessionKeyAddress: res.sessionKeyAddress,
          smartAccountAlias: sa.alias,
          ...encData,
        };

        // Store Now

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

    return SessionKeyManager.of({ createSessionKey });
  }),
);
