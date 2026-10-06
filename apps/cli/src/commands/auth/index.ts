import { Command } from "effect/cli";

import { authStatusCommand } from "./status.js";

export const authCommand = Command.make("auth").pipe(
  Command.withDescription("Check your sign-in status"),
  Command.withSubcommands([authStatusCommand]),
);

export * from "./login.js";
export * from "./logout.js";
