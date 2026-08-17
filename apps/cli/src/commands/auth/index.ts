import { Command } from "effect/unstable/cli";

import { authStatusCommand } from "./status.js";

export const authCommand = Command.make("auth").pipe(
  Command.withDescription("Inspect CLI authentication"),
  Command.withSubcommands([authStatusCommand]),
);

export * from "./login.js";
export * from "./logout.js";
