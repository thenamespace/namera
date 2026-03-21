import { Console, Effect, type Option, Redacted, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { ImportKeystoreParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { KeystoreManager, OutputFormatter, PromptManager } from "@/layers";

const handler = (
  flagAlias: Option.Option<string>,
  flagPassword: Option.Option<Redacted.Redacted<string>>,
  flagPrivateKey: Option.Option<Redacted.Redacted<string>>,
) =>
  Effect.gen(function* () {
    const keystoreManager = yield* KeystoreManager.KeystoreManager;
    const promptManager = yield* PromptManager.PromptManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;

    const globalFlags = yield* getGlobalFlags();

    let params: ImportKeystoreParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(ImportKeystoreParams),
      )(globalFlags.params.value);
    } else {
      let alias: string;
      let password: Redacted.Redacted<string>;
      let privateKey: Redacted.Redacted<string>;

      if (flagAlias._tag === "Some") {
        alias = flagAlias.value;
      } else {
        const res = yield* promptManager.aliasPrompt({
          aliasType: "new",
          message: "Enter alias for keystore:",
          type: "keystore",
        });
        alias = res;
      }

      if (flagPassword._tag === "Some") {
        password = flagPassword.value;
      } else {
        password = yield* promptManager.passwordPrompt({
          message: "Enter password for keystore:",
        });
      }

      if (flagPrivateKey._tag === "Some") {
        privateKey = flagPrivateKey.value;
      } else {
        privateKey = yield* promptManager.hexPrompt({
          redacted: true,
          length: 32,
          message: "Enter private key:",
        });
      }

      params = {
        alias,
        password: Redacted.value(password),
        privateKey: Redacted.value(privateKey),
      };
    }

    const res = yield* keystoreManager.importKeystore(params);

    const data = {
      alias: res.alias,
      address: res.data.address,
      path: res.path,
    };

    if (globalFlags.quite) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the keystore to import"),
  Flag.withAlias("a"),
  Flag.optional,
);

const privateKey = Flag.redacted("private-key").pipe(
  Flag.withDescription("The private key of the keystore to import"),
  Flag.optional,
);

const password = Flag.redacted("password").pipe(
  Flag.withDescription("The password to encrypt the keystore with"),
  Flag.withAlias("p"),
  Flag.optional,
);

/**
 * Command that imports a keystore from a private key.
 */
export const importKeystoreCommand = Command.make(
  "import",
  { alias, privateKey, password },
  ({ alias, password, privateKey }) => handler(alias, password, privateKey),
).pipe(
  Command.withAlias("i"),
  Command.withDescription("Import a keystore from a private key"),
  Command.withExamples([
    {
      command: "namera keystore import",
      description: "Import a keystore with interactive prompts",
    },
    {
      command: "namera keystore import --alias my-wallet",
      description: "Import a keystore with alias 'my-wallet'",
    },
    {
      command:
        "namera keystore import -a my-wallet -p my-password --private-key 0x1234567890abcdef",
      description:
        "Import a keystore with alias 'my-wallet', password 'my-password', and private key '0x1234567890abcdef'",
    },
    {
      command: "namera schema keystore.import",
      description: "Get the schema for the import command",
    },
  ]),
);
