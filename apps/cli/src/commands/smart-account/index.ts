import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createSmartAccountCommand } from "./create";
import { getSmartAccountInfoCommand } from "./info";
import { listSmartAccountsCommand } from "./list";
import { removeSmartAccountCommand } from "./remove";

/**
 * Command group for smart-account related operations.
 */
export const smartAccountCommands = Command.make(
  "smart-account",
  {},
  () => Effect.void,
).pipe(
  Command.withAlias("sa"),
  Command.withDescription("Smart Account management utilities."),
  Command.withSubcommands([
    createSmartAccountCommand,
    listSmartAccountsCommand,
    getSmartAccountInfoCommand,
    removeSmartAccountCommand,
  ]),
);
