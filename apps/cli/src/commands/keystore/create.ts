import { Console, Effect, type Option, Redacted, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { CreateKeystoreParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { KeystoreManager, OutputFormatter, PromptManager } from "@/layers";

const createKeystoreHandler = (
  flagAlias: Option.Option<string>,
  flagPassword: Option.Option<Redacted.Redacted<string>>,
) =>
  Effect.gen(function* () {
    const promptManager = yield* PromptManager.PromptManager;
    const keystoreManager = yield* KeystoreManager.KeystoreManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    let params: CreateKeystoreParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(CreateKeystoreParams),
      )(globalFlags.params.value);
    } else {
      let alias: string;
      let password: Redacted.Redacted<string>;

      if (flagAlias._tag === "Some") {
        alias = flagAlias.value;
      } else {
        alias = yield* promptManager.aliasPrompt({
          aliasType: "new",
          message: "Enter alias for keystore:",
          type: "keystore",
        });
      }

      if (flagPassword._tag === "Some") {
        password = flagPassword.value;
      } else {
        password = yield* promptManager.passwordPrompt({
          message: "Enter password for keystore:",
        });
      }

      params = { alias, password: Redacted.value(password) };
    }

    const res = yield* keystoreManager.createKeystore(params);

    const data = {
      address: res.data.address,
      alias: res.alias,
      path: res.path,
    };

    if (globalFlags.quiet) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the keystore to create"),
  Flag.withAlias("a"),
  Flag.optional,
);

const password = Flag.redacted("password").pipe(
  Flag.withDescription("The password to encrypt the keystore with"),
  Flag.withAlias("p"),
  Flag.optional,
);

/**
 * Command that creates a new keystore and stores it locally.
 */
export const createKeystoreCommand = Command.make(
  "create",
  { alias, password },
  ({ alias, password }) => createKeystoreHandler(alias, password),
).pipe(
  Command.withAlias("c"),
  Command.withDescription("Creates a random keypair and stores it as keystore"),
  Command.withExamples([
    {
      command: "namera keystore create -a my-wallet",
      description: "Creates a new keystore with alias 'my-wallet'",
    },
    {
      command:
        "namera keystore create --alias my-wallet --password my-password",
      description:
        "Creates a new keystore with alias 'my-wallet' and password 'my-password'",
    },
    {
      command: `namera keystore create --params '{"alias":"my-wallet","password":"my-password"}'`,
      description: "Creates a new keystore with json params",
    },
    {
      command: "namera schema keystore.create",
      description: "Get the schema for the create command",
    },
  ]),
);
