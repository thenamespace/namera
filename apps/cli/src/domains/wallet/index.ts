import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createWalletCommand } from "./create";
import { listWalletsCommand } from "./list";

export const walletCommands = Command.make(
  "wallet",
  {},
  () => Effect.void,
).pipe(
  Command.withDescription("Manage Ethereum wallets."),
  Command.withSubcommands([createWalletCommand, listWalletsCommand]),
);
