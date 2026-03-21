import { Console, Effect, type Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { RemoveSmartAccountParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { OutputFormatter, SmartAccountManager } from "@/layers";

const handler = (flagAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const smartAccountManager = yield* SmartAccountManager.SmartAccountManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    let params: RemoveSmartAccountParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(RemoveSmartAccountParams),
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

    yield* smartAccountManager.removeSmartAccount(params);

    const data = { success: true };

    if (globalFlags.quite) return;
    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the smart account to remove"),
  Flag.withAlias("a"),
  Flag.optional,
);

export const removeSmartAccountCommand = Command.make(
  "remove",
  { alias },
  ({ alias }) => handler(alias),
).pipe(
  Command.withAlias("rm"),
  Command.withDescription("Remove a Smart Account"),
  Command.withExamples([
    {
      command: "namera smart-account remove",
      description: "Remove a smart-account with alias prompt",
    },
    {
      command: "namera smart-account remove --alias my-smart",
      description: "Remove a smart account with alias 'my-smart'",
    },
    {
      command: `namera smart-account remove --params '{"alias":"my-smart"}'`,
      description: "Remove a smart account with json params",
    },
    {
      command: "namera schema smart-account.remove",
      description: "Get the schema for the remove smart account command",
    },
  ]),
);
