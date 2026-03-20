import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { getGlobalFlags } from "@/global-flags";
import { KeystoreManager, OutputFormatter } from "@/layers";

const listKeystoreHandler = () =>
  Effect.gen(function* () {
    const keystoreManager = yield* KeystoreManager.KeystoreManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    const res = yield* keystoreManager.listKeystores();

    const data = res.map((k) => ({
      alias: k.alias,
      address: k.data.address,
      path: k.path,
    }));

    if (globalFlags.quite) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

/**
 * Command that lists all stored keystores.
 */
export const listKeystoresCommand = Command.make("list", {}, () =>
  listKeystoreHandler(),
).pipe(
  Command.withAlias("ls"),
  Command.withDescription("List all keystores"),
  Command.withExamples([
    {
      command: "namera keystore list",
      description: "List all keystores",
    },
    {
      command: "namera keystore list --output json",
      description: "List all keystores in json format",
    },
    {
      command: "namera keystore list --output ndjson",
      description: "List all keystores in ndjson format",
    },
    {
      command: "namera schema keystore.list",
      description: "Get the schema for the list command",
    },
  ]),
);
