import { Wallet } from "@ethereumjs/wallet";
import { Console, Effect, type Option, Redacted } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { v7 as uuid } from "uuid";

import {
  AliasManager,
  ConfigManager,
  KeystoreManager,
  PromptManager,
} from "@/layers";

export const createWalletHandler = (existingAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const aliasManager = yield* AliasManager;
    const keystoreManager = yield* KeystoreManager;
    const promptManager = yield* PromptManager;

    const identifier = uuid();
    const entityPath = yield* configManager.getEntityPath({
      identifier,
      type: "keystore",
    });

    const alias = yield* aliasManager.selectAlias({
      existingAlias,
      message: "Enter alias:",
      type: "keystore",
    });

    const password = yield* promptManager.selectPassword({
      message: "Enter password:",
    });

    const content = yield* Effect.promise(() =>
      Wallet.generate().toV3String(Redacted.value(password), {}),
    );

    yield* keystoreManager.createKeystore({ alias, content, identifier });

    yield* Console.log(
      "\n✅ Successfully created wallet.",
      `\nAlias: ${alias}`,
      `\nIdentifier: ${identifier}`,
      `\nPath: ${entityPath}`,
    );
  });

const alias = Flag.string("alias").pipe(
  Flag.optional,
  Flag.withDescription("The alias to use for the wallet."),
  Flag.withAlias("a"),
);

export const createWalletCommand = Command.make(
  "create",
  { alias },
  ({ alias }) => createWalletHandler(alias),
).pipe(
  Command.withAlias("c"),
  Command.withDescription("Creates a random keypair and stores it to keystore"),
  Command.withExamples([
    {
      command: "namera wallet create -a my-wallet",
      description: "Creates a new wallet with alias 'my-wallet'",
    },
    {
      command: "namera wallet create",
      description: "Creates a new wallet with alias prompt",
    },
  ]),
);
