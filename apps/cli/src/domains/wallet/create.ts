import { Wallet } from "@ethereumjs/wallet";
import { Console, Effect, Option, Redacted } from "effect";
import { Command, Flag, Prompt } from "effect/unstable/cli";
import { v7 as uuid } from "uuid";

import { AliasManager, ConfigManager } from "@/layers";

export const createWalletHandler = (alias: Option.Option<string>) =>
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const aliasManager = yield* AliasManager;

    const identifier = uuid();
    const entityPath = yield* configManager.getEntityPath({
      identifier,
      type: "keystore",
    });

    if (Option.isSome(alias)) {
      yield* aliasManager.ensureUniqueAlias({
        alias: alias.value,
        type: "keystore",
      });
    }

    const passwordPrompt = Prompt.password({
      message: "Enter password:",
      validate: (value) =>
        Effect.gen(function* () {
          if (value.length < 8) {
            return yield* Effect.fail(
              "Password must be at least 8 characters long",
            );
          }

          return value;
        }),
    });

    const password = yield* passwordPrompt;

    const keystore = yield* Effect.promise(() =>
      Wallet.generate().toV3String(Redacted.value(password), {}),
    );

    yield* configManager.addEntity({
      data: keystore,
      identifier,
      type: "keystore",
    });

    if (Option.isSome(alias)) {
      yield* aliasManager.setAlias({
        alias: alias.value,
        identifier,
        type: "keystore",
      });
    }

    yield* Console.log(
      "✅ Successfully created wallet.",
      `${alias._op === "Some" ? `\nAlias: ${alias.value}` : ""}`,
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
  Command.withDescription("Create a new Ethereum wallet."),
  Command.withExamples([
    {
      command: "namera wallet create -a my-wallet",
      description: "Create a new wallet with alias 'my-wallet'",
    },
  ]),
);
