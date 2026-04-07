import { Effect } from "effect";
import { CliError, Command } from "effect/unstable/cli";

import { createSmartAccountCommand } from "./create";
import { importSmartAccountCommand } from "./import";
import { getSmartAccountInfoCommand } from "./info";
import { listSmartAccountsCommand } from "./list";
import { removeSmartAccountCommand } from "./remove";
import { getSmartAccountStatus } from "./status";

/**
 * Root command group for smart-account lifecycle actions.
 *
 * Includes create, list, info, remove, status, and import subcommands.
 */
export const smartAccountCommands = Command.make("smart-account", {}, () =>
  Effect.fail(
    new CliError.ShowHelp({
      commandPath: ["namera", "smart-account"],
      errors: [],
    }),
  ),
).pipe(
  Command.withAlias("sa"),
  Command.withDescription("Smart Account management utilities."),
  Command.withSubcommands([
    createSmartAccountCommand,
    listSmartAccountsCommand,
    getSmartAccountInfoCommand,
    removeSmartAccountCommand,
    getSmartAccountStatus,
    importSmartAccountCommand,
  ]),
);
