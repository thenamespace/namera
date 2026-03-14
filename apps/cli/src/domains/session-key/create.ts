import { Wallet } from "@ethereumjs/wallet";
import { createSessionKey } from "@namera-ai/core";
import { Effect, type Option, Redacted } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { createPublicClient, hexToBytes, http } from "viem";
import { sepolia } from "viem/chains";

import {
  AccountManager,
  ConfigManager,
  KeystoreManager,
  PromptManager,
} from "@/layers";

import { cliPoliciesToPolicies } from "./helpers";
import { getPoliciesFromUser } from "./prompts";

const createSessionKeyHandler = (existingAccountAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const accountManager = yield* AccountManager;
    const keystoreManager = yield* KeystoreManager;
    const promptManager = yield* PromptManager;

    const account = yield* accountManager.selectAccount({
      existingAlias: existingAccountAlias,
      message: "Select the account to create the session key for",
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

    const encSessionPrivateKey = yield* Effect.promise(() =>
      Wallet.fromPrivateKey(
        hexToBytes(sessionKey.sessionPrivateKey),
      ).toV3String(Redacted.value(password)),
    );

    // TODO: Use fn from SessionKeyManager
    yield* configManager.addEntity({
      data: JSON.stringify({
        encSessionPrivateKey,
        serializedAccount: sessionKey.serializedAccount,
        serializedPlugin: sessionKey.serializedPlugin,
        sessionKeyAddress: sessionKey.sessionKeyAddress,
        smartAccountIdentifier: account.identifier,
      }),
      identifier: sessionKey.sessionKeyAddress,
      type: "session",
    });
  });

const account = Flag.string("account").pipe(
  Flag.optional,
  Flag.withDescription("The smart account alias to create the session key for"),
  Flag.withAlias("a"),
);

export const createSessionKeyCommand = Command.make(
  "create",
  { account },
  ({ account }) => createSessionKeyHandler(account),
).pipe(
  Command.withDescription("Creates a new smart account for specified owner"),
  Command.withAlias("c"),
  Command.withExamples([]),
);
