import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { getGlobalFlags } from "@/flags/global";
import { OutputFormatter, SmartAccountManager } from "@/layers";

const handler = () =>
  Effect.gen(function* () {
    const smartAccountManager = yield* SmartAccountManager.SmartAccountManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    const res = yield* smartAccountManager.listSmartAccounts();

    const data = res.map((d) => ({
      alias: d.alias,
      address: d.data.smartAccountAddress,
      owner: d.data.ownerAlias,
      index: d.data.index,
      kernelVersion: d.data.kernelVersion,
    }));

    if (globalFlags.quite) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

/**
 * Command that lists all stored smart accounts.
 */
export const listSmartAccountsCommand = Command.make("list", {}, () =>
  handler(),
).pipe(
  Command.withAlias("ls"),
  Command.withDescription("List all smart accounts"),
  Command.withExamples([
    {
      command: "namera smart-account list",
      description: "List all smart accounts",
    },
    {
      command: "namera smart-account list --output json",
      description: "List all smart accounts in json format",
    },
    {
      command: "namera smart-account list --output ndjson",
      description: "List all smart accounts in ndjson format",
    },
    {
      command: "namera schema smart-account.list",
      description: "Get the schema for the list smart account command",
    },
  ]),
);
