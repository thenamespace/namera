import { Console, Effect, type Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { GetKeystoreParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { KeystoreManager, OutputFormatter } from "@/layers";

const getKeystoreInfoHandler = (flagAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const keystoreManager = yield* KeystoreManager.KeystoreManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;

    const globalFlags = yield* getGlobalFlags();

    let params: GetKeystoreParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(GetKeystoreParams),
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

    const res = yield* keystoreManager.getKeystore(params);

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
  Flag.withDescription("The alias of the keystore to retrieve"),
  Flag.withAlias("a"),
  Flag.optional,
);

/**
 * Command that returns metadata for a keystore.
 */
export const getKeystoreInfoCommand = Command.make(
  "info",
  { alias },
  ({ alias }) => getKeystoreInfoHandler(alias),
).pipe(
  Command.withDescription("Get information about a keystore"),
  Command.withExamples([
    {
      command: "namera keystore info",
      description: "Get information about a keystore with alias prompt",
    },
    {
      command: "namera keystore info --alias my-wallet",
      description: "Get information about a keystore with alias 'my-wallet'",
    },
    {
      command: `namera keystore info --params '{"alias":"my-wallet"}'`,
      description: "Get information about a keystore with json params",
    },
    {
      command: "namera keystore info --alias my-wallet --output json",
      description: "Get information about a keystore in json format",
    },
    {
      command: "namera schema keystore.info",
      description: "Get the schema for the info command",
    },
  ]),
);
