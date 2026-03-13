import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createWalletCommand } from "./create";
import { listWalletsCommand } from "./list";

export const walletCommands = Command.make(
  "wallet",
  {},
  () => Effect.void,
).pipe(
  Command.withDescription("Wallet management utilities."),
  Command.withAlias("w"),
  Command.withSubcommands([createWalletCommand, listWalletsCommand]),
);
