import { Console, Effect, type Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { GetKeystoreParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { OutputFormatter, SmartAccountManager } from "@/layers";

const handler = (flagAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const smartAccountManager = yield* SmartAccountManager.SmartAccountManager;
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
        const res = yield* smartAccountManager.selectSmartAccount({
          message: "Select Smart Account:",
        });
        alias = res.alias;
      }

      params = { alias };
    }

    const res = yield* smartAccountManager.getSmartAccount(params);

    const data = {
      alias: res.alias,
      address: res.data.smartAccountAddress,
      owner: res.data.ownerAlias,
      index: Number(res.data.index),
      kernelVersion: res.data.kernelVersion,
    };

    if (globalFlags.quite) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the smart account to retrieve"),
  Flag.withAlias("a"),
  Flag.optional,
);

/**
 * Command that returns stored metadata for a smart account.
 *
 * Accepts alias via flag or JSON params, otherwise prompts for selection.
 */
export const getSmartAccountInfoCommand = Command.make(
  "info",
  { alias },
  ({ alias }) => handler(alias),
).pipe(
  Command.withDescription("Get information about a smart account"),
  Command.withExamples([
    {
      command: "namera smart-account info",
      description: "Get information about a smart account with alias prompt",
    },
    {
      command: "namera smart-account info --alias my-smart",
      description:
        "Get information about a smart account with alias 'my-smart'",
    },
    {
      command: `namera smart-account info --params '{"alias":"my-smart"}'`,
      description: "Get information about a smart account with json params",
    },
    {
      command: "namera smart-account info --alias my-wallet --output json",
      description: "Get information about a smart account in json format",
    },
    {
      command: "namera schema smart-account.info",
      description: "Get the schema for the smart account info command",
    },
  ]),
);
