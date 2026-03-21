import { Console, Effect, type Option, Redacted, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { DecryptKeystoreParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { KeystoreManager, OutputFormatter, PromptManager } from "@/layers";

const handler = (
  flagAlias: Option.Option<string>,
  flagPassword: Option.Option<Redacted.Redacted<string>>,
) =>
  Effect.gen(function* () {
    const keystoreManager = yield* KeystoreManager.KeystoreManager;
    const promptManager = yield* PromptManager.PromptManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;

    const globalFlags = yield* getGlobalFlags();

    let params: DecryptKeystoreParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(DecryptKeystoreParams),
      )(globalFlags.params.value);
    } else {
      let alias: string;
      let password: Redacted.Redacted<string>;

      if (flagAlias._tag === "Some") {
        alias = flagAlias.value;
      } else {
        const res = yield* keystoreManager.selectKeystore({
          message: "Select keystore:",
        });
        alias = res.alias;
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

    const res = yield* keystoreManager.decryptKeystore(params);

    const data = {
      alias: res.alias,
      address: res.address,
      publicKey: res.publicKey,
      privateKey: Redacted.value(res.privateKey),
    };

    if (globalFlags.quite) return;
    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the keystore to decrypt"),
  Flag.withAlias("a"),
  Flag.optional,
);

const password = Flag.redacted("password").pipe(
  Flag.withDescription("The password to decrypt the keystore with"),
  Flag.withAlias("p"),
  Flag.optional,
);

/**
 * Command that decrypts a keystore and prints key material.
 */
export const decryptKeystoreCommand = Command.make(
  "decrypt",
  { alias, password },
  ({ alias, password }) => handler(alias, password),
).pipe(
  Command.withAlias("d"),
  Command.withDescription("Decrypt a keystore to get the private key"),
  Command.withExamples([
    {
      command: "namera keystore decrypt",
      description: "Decrypt a keystore with alias and password prompts",
    },
    {
      command:
        "namera keystore decrypt --alias my-wallet --password my-password",
      description: "Decrypt a keystore with alias and password",
    },
    {
      command: `namera keystore decrypt --params '{"alias":"my-wallet","password":"my-password"}'`,
      description: "Decrypt a keystore with json params",
    },
    {
      command: "namera schema keystore.decrypt",
      description: "Get the schema for the decrypt command",
    },
  ]),
);
