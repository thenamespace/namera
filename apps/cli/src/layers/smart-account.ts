import { createEcdsaAccountClient } from "@namera-ai/core/account";
import { Data, Effect, Layer, Schema, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import type { Prompt } from "effect/unstable/cli";
import type { Environment } from "effect/unstable/cli/Prompt";
import { createPublicClient, http, type PublicClient } from "viem";
import { mainnet } from "viem/chains";

import {
  type CreateSmartAccountParams,
  type GetSmartAccountParams,
  type GetSmartAccountStatusParams,
  type ImportSmartAccountParams,
  LocalSmartAccount,
  type LocalSmartAccountData,
  type RemoveSmartAccountParams,
} from "@/dto";

import { ConfigManager, type ConfigManagerError } from "./config";
import { KeystoreManager, type KeystoreManagerError } from "./keystore";
import { PromptManager } from "./prompt";
import { Web3Service } from "./web3";

export type SmartAccountManager = {
  /**
   * Loads a smart account by alias and parses the stored JSON payload.
   *
   * @param params  Alias of the smart account to load.
   * @returns The parsed smart account data.
   */
  getSmartAccount: (
    params: GetSmartAccountParams,
  ) => Effect.Effect<LocalSmartAccountData, ConfigManagerError, never>;
  /**
   * Lists all locally stored smart accounts.
   *
   * @returns The list of smart account data.
   */
  listSmartAccounts: () => Effect.Effect<
    LocalSmartAccountData[],
    ConfigManagerError,
    never
  >;
  /**
   * Prompts the user to select a smart account from local storage.
   *
   * @param params - Prompt message to display.
   * @returns The selected smart account data.
   */
  selectSmartAccount: (params: {
    message: string;
  }) => Effect.Effect<
    LocalSmartAccountData,
    ConfigManagerError | KeystoreManagerError | QuitError,
    Environment
  >;
  /**
   * Creates a new smart account derived from a local keystore and index.
   *
   * @param params - Alias, owner alias, and optional index for derivation.
   * @returns The created smart account data.
   */
  createSmartAccount: (
    params: CreateSmartAccountParams,
  ) => Effect.Effect<
    LocalSmartAccountData,
    SmartAccountManagerError | ConfigManagerError | KeystoreManagerError,
    never
  >;
  /**
   * Removes a locally stored smart account by alias.
   *
   * @param params - Alias of the smart account to remove.
   */
  removeSmartAccount: (
    params: RemoveSmartAccountParams,
  ) => Effect.Effect<
    void,
    ConfigManagerError | SmartAccountManagerError,
    never
  >;
  /**
   * Checks if a smart account is deployed on the specified chain.
   *
   * @param params - Alias plus chain and optional RPC URL.
   * @returns Whether the smart account is deployed.
   */
  getSmartAccountStatus: (
    params: GetSmartAccountStatusParams,
  ) => Effect.Effect<boolean, ConfigManagerError, never>;
  /**
   * Imports a smart account with precomputed metadata and address.
   *
   * @param params - Smart account metadata and alias to store.
   * @returns The imported smart account data.
   */
  importSmartAccount: (
    params: ImportSmartAccountParams,
  ) => Effect.Effect<
    LocalSmartAccountData,
    SmartAccountManagerError | ConfigManagerError | KeystoreManagerError,
    never
  >;
};

/**
 * Service tag for resolving {@link SmartAccountManager} from the Effect context.
 */
export const SmartAccountManager = ServiceMap.Service<SmartAccountManager>(
  "@namera-ai/cli/SmartAccountManager",
);

/**
 * Domain error for smart account lifecycle operations.
 */
export class SmartAccountManagerError extends Data.TaggedError(
  "@namera-ai/cli/SmartAccountManagerError",
)<{
  code:
    | "KernelAddressGenerationError"
    | "SmartAccountAlreadyExists"
    | "SmartAccountNotFound"
    | "SmartAccountImportError";
  message: string;
}> {}

/**
 * Live layer that manages smart account storage and derivation.
 */
export const layer = Layer.effect(
  SmartAccountManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const keystoreManager = yield* KeystoreManager;
    const promptManager = yield* PromptManager;
    const web3Service = yield* Web3Service;

    const getSmartAccount = (params: GetSmartAccountParams) =>
      Effect.gen(function* () {
        const res = yield* configManager.getEntity({
          alias: params.alias,
          type: "smart-account",
        });

        const parsedSmartAccount = Schema.decodeUnknownSync(
          Schema.fromJsonString(LocalSmartAccount),
        )(res.content);

        return {
          alias: res.alias,
          data: parsedSmartAccount,
          path: res.path,
        } satisfies LocalSmartAccountData;
      });

    const listSmartAccounts = () =>
      Effect.gen(function* () {
        const res = yield* configManager.getEntitiesForType("smart-account");

        const effects = res.map((entity) =>
          Effect.gen(function* () {
            const parsedSmartAccount = Schema.decodeUnknownSync(
              Schema.fromJsonString(LocalSmartAccount),
            )(entity.content);

            return {
              alias: entity.alias,
              data: parsedSmartAccount,
              path: entity.path,
            } satisfies LocalSmartAccountData;
          }),
        );

        return yield* Effect.all(effects, { concurrency: "unbounded" });
      });

    const createSmartAccount = (params: CreateSmartAccountParams) =>
      Effect.gen(function* () {
        const existingAccounts = yield* listSmartAccounts();

        const entityPath = yield* configManager.getEntityPath({
          alias: params.alias,
          type: "smart-account",
        });

        const ownerKeystore = yield* keystoreManager.getKeystore({
          alias: params.ownerAlias,
        });

        const ownerSigner = yield* keystoreManager.getSigner({
          alias: params.ownerAlias,
          password: params.ownerPassword,
        });

        // Doesn't matter because public client is only needed for 0.6 entrypoints
        const publicClient = createPublicClient({
          chain: mainnet,
          transport: http(),
        });

        const entryPointVersion = "0.7";
        const kernelVersion = "0.3.2";
        const index = BigInt(params.index ?? 0);
        const ownerType = "ecdsa";

        const res = yield* Effect.tryPromise({
          try: () =>
            createEcdsaAccountClient({
              bundlerTransport: http(),
              chain: mainnet,
              client: publicClient,
              entrypointVersion: entryPointVersion,
              kernelVersion,
              signer: ownerSigner,
            }),
          catch: () =>
            new SmartAccountManagerError({
              code: "KernelAddressGenerationError",
              message: `Unable to compute smart account address for Address: ${ownerKeystore.data.address} and Index: ${params.index}`,
            }),
        });

        const saAddress = res.account.address;

        const exists = existingAccounts.find(
          (d) => d.data.smartAccountAddress === saAddress,
        );

        if (exists) {
          return yield* Effect.fail(
            new SmartAccountManagerError({
              code: "SmartAccountAlreadyExists",
              message: `Smart account for owner: ${ownerKeystore.alias} and index: ${params.index} already exists`,
            }),
          );
        }

        const saData: LocalSmartAccount = {
          entryPointVersion,
          kernelVersion,
          ownerAlias: ownerKeystore.alias,
          ownerType,
          smartAccountAddress: saAddress,
          index,
        };

        const data: LocalSmartAccountData = {
          data: saData,
          path: entityPath,
          alias: params.alias,
        };

        const encoded = Schema.encodeSync(LocalSmartAccount)(saData);

        yield* configManager.storeEntity({
          alias: params.alias,
          content: JSON.stringify(encoded),
          path: entityPath,
          type: "smart-account",
        });

        return data;
      });

    const selectSmartAccount = (params: { message: string }) =>
      Effect.gen(function* () {
        const smartAccounts = yield* listSmartAccounts();

        const res = yield* promptManager.selectPrompt({
          message: params.message,
          choices: smartAccounts.map((a) => ({
            title: a.alias,
            value: a,
            description: a.data.smartAccountAddress,
          })) satisfies Prompt.SelectChoice<LocalSmartAccountData>[],
        });

        return res;
      });

    const removeSmartAccount = (params: RemoveSmartAccountParams) =>
      Effect.gen(function* () {
        const sa = yield* getSmartAccount({ alias: params.alias });

        return yield* configManager.removeEntity({
          alias: sa.alias,
          type: "smart-account",
        });
      });

    const getSmartAccountStatus = (params: GetSmartAccountStatusParams) =>
      Effect.gen(function* () {
        const sa = yield* getSmartAccount({ alias: params.alias });

        const publicClient = (yield* web3Service.getPublicClient({
          chain: params.chain,
          rpcUrl: params.rpcUrl,
        })) as PublicClient;

        const code = yield* Effect.promise(() =>
          publicClient.getCode({
            address: sa.data.smartAccountAddress,
          }),
        );

        return Boolean(code);
      });

    const importSmartAccount = (params: ImportSmartAccountParams) =>
      Effect.gen(function* () {
        const { alias, ...rest } = params;
        const entityPath = yield* configManager.getEntityPath({
          alias: params.alias,
          type: "smart-account",
        });

        const ownerKeystore = yield* keystoreManager.getKeystore({
          alias: params.ownerAlias,
        });

        const allAccounts = yield* listSmartAccounts();

        const exists = allAccounts.find(
          (d) => d.data.smartAccountAddress === rest.smartAccountAddress,
        );

        if (exists) {
          return yield* Effect.fail(
            new SmartAccountManagerError({
              code: "SmartAccountAlreadyExists",
              message: `Smart account for owner: ${ownerKeystore.alias} and address: ${rest.smartAccountAddress} already exists`,
            }),
          );
        }

        yield* configManager.storeEntity({
          alias: params.alias,
          content: JSON.stringify(Schema.encodeSync(LocalSmartAccount)(rest)),
          path: entityPath,
          type: "smart-account",
        });

        return {
          alias: params.alias,
          data: rest,
          path: entityPath,
        };
      });

    return SmartAccountManager.of({
      createSmartAccount,
      getSmartAccount,
      listSmartAccounts,
      selectSmartAccount,
      removeSmartAccount,
      getSmartAccountStatus,
      importSmartAccount,
    });
  }),
);
