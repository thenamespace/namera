import { Wallet } from "@ethereumjs/wallet";
import { createSessionKey } from "@namera-ai/core";
import { Console, Effect, type Option, Redacted } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { createPublicClient, hexToBytes, http } from "viem";
import { sepolia } from "viem/chains";

import {
  AccountManager,
  AliasManager,
  ConfigManager,
  KeystoreManager,
  PromptManager,
  SessionKeyManager,
  type V3Keystore,
} from "@/layers";

import { cliPoliciesToPolicies } from "./helpers";
import { getPoliciesFromUser } from "./prompts";

const createSessionKeyHandler = (
  existingAccountAlias: Option.Option<string>,
  existingAlias: Option.Option<string>,
) =>
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const accountManager = yield* AccountManager;
    const aliasManager = yield* AliasManager;
    const keystoreManager = yield* KeystoreManager;
    const promptManager = yield* PromptManager;
    const sessionKeyManager = yield* SessionKeyManager;

    const account = yield* accountManager.selectAccount({
      existingAlias: existingAccountAlias,
      message: "Select the account to create the session key for",
    });

    const alias = yield* aliasManager.selectAlias({
      existingAlias,
      message: "Enter alias for the session key:",
      type: "session-key",
    });

    const cliPolicies = yield* getPoliciesFromUser();

    const signer = yield* keystoreManager.getKeystoreSigner({
      identifier: account.data.ownerIdentifier,
    });

    // Signer, Public Client
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });

    const policies = cliPoliciesToPolicies(cliPolicies);

    const sessionKey = yield* Effect.promise(() =>
      createSessionKey({
        client: publicClient,
        index: BigInt(account.data.index),
        policies,
        signer,
      }),
    );

    const password = yield* promptManager.selectPassword({
      message: "Enter password to encrypt session key: ",
      validate: (v) =>
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            catch: () => "Invalid Password",
            try: () =>
              Wallet.fromPrivateKey(
                hexToBytes(sessionKey.sessionPrivateKey),
              ).toV3String(v),
          });

          return v;
        }),
    });

    const encSessionPrivateKey = (yield* Effect.promise(() =>
      Wallet.fromPrivateKey(hexToBytes(sessionKey.sessionPrivateKey)).toV3(
        Redacted.value(password),
      ),
    )) as V3Keystore;

    yield* sessionKeyManager.storeSessionKey(alias, {
      encSessionPrivateKey,
      serializedAccount: sessionKey.serializedAccount,
      serializedPlugin: {
        permissionId: sessionKey.serializedPlugin.permissionId,
        policies: cliPolicies,
      },
      sessionKeyAddress: sessionKey.sessionKeyAddress,
      smartAccountIdentifier: account.identifier,
    });

    const entityPath = yield* configManager.getEntityPath({
      identifier: sessionKey.sessionKeyAddress,
      type: "session-key",
    });

    yield* Console.log(
      "\n✅ Successfully created Session Key",
      `\nAlias: ${alias}`,
      `\nSmart Account Address: ${account.data.smartAccountAddress}`,
      `\nAccount Address: ${sessionKey.sessionKeyAddress}`,
      `\nPath: ${entityPath}`,
    );
  });

const account = Flag.string("account").pipe(
  Flag.optional,
  Flag.withDescription("The smart account alias to create the session key for"),
);

const alias = Flag.string("alias").pipe(
  Flag.optional,
  Flag.withDescription("Alias for the session key"),
  Flag.withAlias("a"),
);

export const createSessionKeyCommand = Command.make(
  "create",
  { account, alias },
  ({ account, alias }) => createSessionKeyHandler(account, alias),
).pipe(
  Command.withDescription("Creates a new smart account for specified owner"),
  Command.withAlias("c"),
  Command.withExamples([]),
);
