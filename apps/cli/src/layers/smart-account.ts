import { getKernelAddressFromECDSA } from "@namera-ai/core/account";
import { Data, Effect, Layer, Schema, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import type { Prompt } from "effect/unstable/cli";
import type { Environment } from "effect/unstable/cli/Prompt";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

import {
  type CreateSmartAccountParams,
  type GetSmartAccountParams,
  LocalSmartAccount,
  type LocalSmartAccountData,
  type RemoveSmartAccountParams,
} from "@/dto";

import { ConfigManager, type ConfigManagerError } from "./config";
import { KeystoreManager, type KeystoreManagerError } from "./keystore";
import { PromptManager } from "./prompt";

export type SmartAccountManager = {
  getSmartAccount: (
    params: GetSmartAccountParams,
  ) => Effect.Effect<LocalSmartAccountData, ConfigManagerError, never>;
  listSmartAccounts: () => Effect.Effect<
    LocalSmartAccountData[],
    ConfigManagerError,
    never
  >;
  selectSmartAccount: (params: {
    message: string;
  }) => Effect.Effect<
    LocalSmartAccountData,
    ConfigManagerError | KeystoreManagerError | QuitError,
    Environment
  >;
  createSmartAccount: (
    params: CreateSmartAccountParams,
  ) => Effect.Effect<
    LocalSmartAccountData,
    SmartAccountManagerError | ConfigManagerError | KeystoreManagerError,
    never
  >;
  removeSmartAccount: (
    params: RemoveSmartAccountParams,
  ) => Effect.Effect<
    void,
    ConfigManagerError | SmartAccountManagerError,
    never
  >;
};

export const SmartAccountManager = ServiceMap.Service<SmartAccountManager>(
  "@namera-ai/cli/SmartAccountManager",
);

export class SmartAccountManagerError extends Data.TaggedError(
  "@namera-ai/cli/SmartAccountManagerError",
)<{
  code:
    | "KernelAddressGenerationError"
    | "SmartAccountAlreadyExists"
    | "SmartAccountNotFound";
  message: string;
}> {}

export const layer = Layer.effect(
  SmartAccountManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const keystoreManager = yield* KeystoreManager;
    const promptManager = yield* PromptManager;

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

        // Doesn't matter because public client is only needed for 0.6 entrypoints
        const publicClient = createPublicClient({
          chain: mainnet,
          transport: http(),
        });

        const entryPointVersion = "0.7";
        const kernelVersion = "0.3.2";
        const index = BigInt(params.index ?? 0);
        const ownerType = "ecdsa";
        const eoaAddress = ownerKeystore.data.address;

        const saAddress = yield* Effect.tryPromise({
          try: () =>
            getKernelAddressFromECDSA({
              entryPointVersion,
              eoaAddress,
              kernelVersion,
              index,
              publicClient,
            }),
          catch: () =>
            new SmartAccountManagerError({
              code: "KernelAddressGenerationError",
              message: `Unable to compute smart account address for Address: ${ownerKeystore.data.address} and Index: ${params.index}`,
            }),
        });

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
          index: Number(index),
        };

        const data: LocalSmartAccountData = {
          data: saData,
          path: entityPath,
          alias: params.alias,
        };

        yield* configManager.storeEntity({
          alias: params.alias,
          content: JSON.stringify(saData),
          path: entityPath,
          type: "smart-account",
        });

        return data;
      });

    const selectSmartAccount = (params: { message: string }) =>
      Effect.gen(function* () {
        const keystores = yield* listSmartAccounts();

        const res = yield* promptManager.selectPrompt({
          message: params.message,
          choices: keystores.map((k) => ({
            title: k.alias,
            value: k,
            description: k.data.smartAccountAddress,
          })) satisfies Prompt.SelectChoice<LocalSmartAccountData>[],
        });

        return res;
      });

    const removeSmartAccount = (params: RemoveSmartAccountParams) =>
      Effect.gen(function* () {
        // Check if alias exists
        const exists = yield* configManager.checkEntityExists({
          alias: params.alias,
          type: "smart-account",
        });

        if (!exists) {
          return yield* Effect.fail(
            new SmartAccountManagerError({
              code: "SmartAccountNotFound",
              message: `Smart Account with alias ${params.alias} does not exist`,
            }),
          );
        }

        return yield* configManager.removeEntity({
          alias: params.alias,
          type: "smart-account",
        });
      });

    return SmartAccountManager.of({
      createSmartAccount,
      getSmartAccount,
      listSmartAccounts,
      selectSmartAccount,
      removeSmartAccount,
    });
  }),
);
