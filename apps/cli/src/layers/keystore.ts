import { Wallet as EthereumJSWallet } from "@ethereumjs/wallet";
import { Data, Effect, Layer, Redacted, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import type { Prompt } from "effect/unstable/cli";
import type { Environment } from "effect/unstable/cli/Prompt";
import { type Hex, hexToBytes, toHex } from "viem";
import { type LocalAccount, privateKeyToAccount } from "viem/accounts";

import type {
  CreateKeystoreParams,
  DecryptKeystoreParams,
  DecryptKeystoreResponse,
  GetKeystoreParams,
  GetSignerParams,
  ImportKeystoreParams,
  Keystore,
  KeystoreData,
  RemoveKeystoreParams,
} from "@/dto";

import { ConfigManager, type ConfigManagerError } from "./config";
import { PromptManager } from "./prompt";

/**
 * Effect service for keystore CRUD, selection, and decryption operations.
 */
export type KeystoreManager = {
  /**
   * Loads a keystore by alias and parses it into a typed keystore data object.
   *
   * @param params - Alias for the keystore to load.
   */
  getKeystore: (
    params: GetKeystoreParams,
  ) => Effect.Effect<KeystoreData, ConfigManagerError | KeystoreManagerError>;
  /**
   * Lists all stored keystores, parsing each into a typed keystore data object.
   */
  listKeystores: () => Effect.Effect<
    KeystoreData[],
    ConfigManagerError | KeystoreManagerError
  >;
  /**
   * Opens an interactive prompt to select a keystore from stored entries.
   *
   * @param params - Prompt message.
   */
  selectKeystore: (params: {
    message: string;
  }) => Effect.Effect<
    KeystoreData,
    ConfigManagerError | KeystoreManagerError | QuitError,
    Environment
  >;
  /**
   * Creates a new random wallet, encrypts it, and stores as a keystore.
   *
   * @param params - Alias and password used for the new keystore.
   */
  createKeystore: (
    params: CreateKeystoreParams,
  ) => Effect.Effect<KeystoreData, ConfigManagerError | KeystoreManagerError>;
  /**
   * Decrypts a keystore and returns key material.
   *
   * @param params - Alias and password for the keystore to decrypt.
   */
  decryptKeystore: (
    params: DecryptKeystoreParams,
  ) => Effect.Effect<
    DecryptKeystoreResponse,
    KeystoreManagerError | ConfigManagerError
  >;
  /**
   * Imports a keystore from a private key and stores as a keystore.
   *
   * @param params - Alias and private key for the keystore to import.
   */
  importKeystore: (
    params: ImportKeystoreParams,
  ) => Effect.Effect<
    KeystoreData,
    ConfigManagerError | KeystoreManagerError,
    never
  >;
  /**
   * Removes a keystore from storage.
   *
   * @param params - Alias of the keystore to remove.
   */
  removeKeystore: (params: {
    readonly alias: string;
  }) => Effect.Effect<void, ConfigManagerError | KeystoreManagerError, never>;
  getSigner: (
    params: GetSignerParams,
  ) => Effect.Effect<LocalAccount, ConfigManagerError | KeystoreManagerError>;
};

/**
 * Service tag for resolving {@link KeystoreManager} from the Effect context.
 */
export const KeystoreManager = ServiceMap.Service<KeystoreManager>(
  "@namera-ai/cli/KeystoreManager",
);

/**
 * Domain error for keystore management operations.
 */
export class KeystoreManagerError extends Data.TaggedError(
  "@namera-ai/cli/KeystoreManagerError",
)<{
  code:
    | "KeystoreParseError"
    | "KeystoreAlreadyExists"
    | "KeystoreCreationFailed"
    | "KeystoreDecryptionFailed"
    | "KeystoreNotFound";
  message: string;
}> {}

/**
 * Live layer wiring the keystore manager with configuration and prompts.
 */
export const layer = Layer.effect(
  KeystoreManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const promptManager = yield* PromptManager;

    const getKeystore = (params: GetKeystoreParams) =>
      Effect.gen(function* () {
        const res = yield* configManager.getEntity({
          alias: params.alias,
          type: "keystore",
        });

        const parsedKeystore = yield* Effect.try({
          catch: () =>
            new KeystoreManagerError({
              code: "KeystoreParseError",
              message: "Unable to parse keystore",
            }),
          try: () => JSON.parse(res.content) as Keystore,
        });

        const wallet: KeystoreData = {
          alias: res.alias,
          data: {
            ...parsedKeystore,
            address: `0x${parsedKeystore.address}`,
          },
          path: res.path,
        };

        return wallet;
      });

    const listKeystores = () =>
      Effect.gen(function* () {
        const res = yield* configManager.getEntitiesForType("keystore");

        const effects = res.map((entity) =>
          Effect.gen(function* () {
            const parsedKeystore = yield* Effect.try({
              catch: () =>
                new KeystoreManagerError({
                  code: "KeystoreParseError",
                  message: "Unable to parse keystore",
                }),
              try: () => JSON.parse(entity.content) as Keystore,
            });

            const wallet: KeystoreData = {
              alias: entity.alias,
              data: {
                ...parsedKeystore,
                address: `0x${parsedKeystore.address}`,
              },
              path: entity.path,
            };

            return wallet;
          }),
        );

        return yield* Effect.all(effects, { concurrency: "unbounded" });
      });

    const createKeystore = (params: CreateKeystoreParams) =>
      Effect.gen(function* () {
        const entityPath = yield* configManager.getEntityPath({
          alias: params.alias,
          type: "keystore",
        });

        // Check if alias is already taken
        const aliasTaken = yield* configManager.checkEntityExists({
          alias: params.alias,
          type: "keystore",
        });

        if (aliasTaken) {
          return yield* Effect.fail(
            new KeystoreManagerError({
              code: "KeystoreAlreadyExists",
              message: `Keystore with alias ${params.alias} already exists`,
            }),
          );
        }

        const keystoreString = yield* Effect.tryPromise({
          catch: () =>
            new KeystoreManagerError({
              code: "KeystoreCreationFailed",
              message: "Failed to create keystore",
            }),
          try: () => EthereumJSWallet.generate().toV3String(params.password),
        });

        // Store Entity
        yield* configManager.storeEntity({
          alias: params.alias,
          content: keystoreString,
          path: entityPath,
          type: "keystore",
        });

        const keystore = yield* Effect.try({
          catch: () =>
            new KeystoreManagerError({
              code: "KeystoreParseError",
              message: "Unable to parse keystore",
            }),
          try: () => JSON.parse(keystoreString) as Keystore,
        });

        const data: KeystoreData = {
          alias: params.alias,
          data: keystore,
          path: entityPath,
        };

        return data;
      });

    const decryptKeystore = (params: DecryptKeystoreParams) =>
      Effect.gen(function* () {
        const keystore = yield* getKeystore({
          alias: params.alias,
        });

        const wallet = yield* Effect.tryPromise({
          catch: () =>
            new KeystoreManagerError({
              code: "KeystoreDecryptionFailed",
              message: "Failed to decrypt keystore",
            }),
          try: () => EthereumJSWallet.fromV3(keystore.data, params.password),
        });

        return {
          address: wallet.getChecksumAddressString(),
          alias: params.alias,
          privateKey: Redacted.make(wallet.getPrivateKeyString()),
          publicKey: wallet.getPublicKeyString(),
        };
      });

    const selectKeystore = (params: { message: string }) =>
      Effect.gen(function* () {
        const keystores = yield* listKeystores();

        const res = yield* promptManager.selectPrompt({
          message: params.message,
          choices: keystores.map((k) => ({
            title: k.alias,
            value: k,
            description: k.data.address,
          })) satisfies Prompt.SelectChoice<KeystoreData>[],
        });

        return res;
      });

    const importKeystore = (params: ImportKeystoreParams) =>
      Effect.gen(function* () {
        const entityPath = yield* configManager.getEntityPath({
          alias: params.alias,
          type: "keystore",
        });

        // Check if alias is already taken
        const aliasTaken = yield* configManager.checkEntityExists({
          alias: params.alias,
          type: "keystore",
        });

        if (aliasTaken) {
          return yield* Effect.fail(
            new KeystoreManagerError({
              code: "KeystoreAlreadyExists",
              message: `Keystore with alias ${params.alias} already exists`,
            }),
          );
        }

        const keystoreString = yield* Effect.tryPromise({
          catch: () =>
            new KeystoreManagerError({
              code: "KeystoreCreationFailed",
              message: "Failed to create keystore",
            }),
          try: () =>
            EthereumJSWallet.fromPrivateKey(
              hexToBytes(params.privateKey as Hex),
            ).toV3String(params.password),
        });

        // Store Entity
        yield* configManager.storeEntity({
          alias: params.alias,
          content: keystoreString,
          path: entityPath,
          type: "keystore",
        });

        const keystore = yield* Effect.try({
          catch: () =>
            new KeystoreManagerError({
              code: "KeystoreParseError",
              message: "Unable to parse keystore",
            }),
          try: () => JSON.parse(keystoreString) as Keystore,
        });

        const data: KeystoreData = {
          alias: params.alias,
          data: keystore,
          path: entityPath,
        };

        return data;
      });

    const removeKeystore = (params: RemoveKeystoreParams) =>
      Effect.gen(function* () {
        // Check if alias exists
        const exists = yield* configManager.checkEntityExists({
          alias: params.alias,
          type: "keystore",
        });

        if (!exists) {
          return yield* Effect.fail(
            new KeystoreManagerError({
              code: "KeystoreNotFound",
              message: `Keystore with alias ${params.alias} does not exist`,
            }),
          );
        }

        return yield* configManager.removeEntity({
          alias: params.alias,
          type: "keystore",
        });
      });

    const getSigner = (params: GetSignerParams) =>
      Effect.gen(function* () {
        const keystore = yield* getKeystore({ alias: params.alias });

        const wallet = yield* Effect.tryPromise({
          catch: () =>
            new KeystoreManagerError({
              code: "KeystoreDecryptionFailed",
              message: "Failed to decrypt keystore",
            }),
          try: () => EthereumJSWallet.fromV3(keystore.data, params.password),
        });

        return privateKeyToAccount(
          toHex(wallet.getPrivateKey()),
        ) as LocalAccount;
      });

    return KeystoreManager.of({
      createKeystore,
      decryptKeystore,
      getKeystore,
      listKeystores,
      selectKeystore,
      importKeystore,
      removeKeystore,
      getSigner,
    });
  }),
);
