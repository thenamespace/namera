import { Console, Effect, type Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { RemoveKeystoreParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { KeystoreManager, OutputFormatter } from "@/layers";

const handler = (flagAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const keystoreManager = yield* KeystoreManager.KeystoreManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    let params: RemoveKeystoreParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(RemoveKeystoreParams),
      )(globalFlags.params.value);
    } else {
      let alias: string;

      if (flagAlias._tag === "Some") {
        alias = flagAlias.value;
      } else {
        const res = yield* keystoreManager.selectKeystore({
          message: "Select keystore:",
        });
        alias = res.alias;
      }

      params = { alias };
    }

    yield* keystoreManager.removeKeystore(params);

    const data = { success: true };

    if (globalFlags.quiet) return;
    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the keystore to remove"),
  Flag.withAlias("a"),
  Flag.optional,
);

export const removeKeystoreCommand = Command.make(
  "remove",
  { alias },
  ({ alias }) => handler(alias),
).pipe(
  Command.withAlias("rm"),
  Command.withDescription("Remove a keystore"),
  Command.withExamples([
    {
      command: "namera keystore remove",
      description: "Remove a keystore with alias prompt",
    },
    {
      command: "namera keystore remove --alias my-wallet",
      description: "Remove a keystore with alias 'my-wallet'",
    },
    {
      command: `namera keystore remove --params '{"alias":"my-wallet"}'`,
      description: "Remove a keystore with json params",
    },
    {
      command: "namera schema keystore.remove",
      description: "Get the schema for the remove command",
    },
  ]),
);
