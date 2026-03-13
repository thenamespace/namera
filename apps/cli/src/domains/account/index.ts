import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createAccountCommand } from "./create";
import { listAccountsCommand } from "./list";

export const accountCommands = Command.make(
  "account",
  {},
  () => Effect.void,
).pipe(
  Command.withDescription("Smart Accounts management utilities."),
  Command.withAlias("a"),
  Command.withSubcommands([createAccountCommand, listAccountsCommand]),
);
