import { Wallet } from "@ethereumjs/wallet";
import { Console, Effect, Option, Redacted } from "effect";
import { Command, Flag, Prompt } from "effect/unstable/cli";
import { v7 as uuid } from "uuid";

import { AliasManager, ConfigManager, KeystoreManager } from "@/layers";

export const createWalletHandler = (_alias: Option.Option<string>) =>
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const aliasManager = yield* AliasManager;
    const keystoreManager = yield* KeystoreManager;

    const identifier = uuid();
    const entityPath = yield* configManager.getEntityPath({
      identifier,
      type: "keystore",
    });

    let alias: string;

    if (Option.isSome(_alias)) {
      yield* aliasManager.ensureUniqueAlias({
        alias: _alias.value,
        type: "keystore",
      });
      alias = _alias.value;
    } else {
      alias = yield* Prompt.text({
        message: "Enter alias:",
        validate: (value) =>
          Effect.gen(function* () {
            yield* aliasManager
              .ensureUniqueAlias({
                alias: value,
                type: "keystore",
              })
              .pipe(
                Effect.catchTag("AliasError", () =>
                  Effect.fail("Alias already exists"),
                ),
              );

            return value;
          }),
      });
    }

    const password = yield* Prompt.password({
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
  Command.withDescription(
    "Creates a random keypair and stores it to keystore.",
  ),
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
