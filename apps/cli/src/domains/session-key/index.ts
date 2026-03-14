import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createSessionKeyCommand } from "./create";

export const sessionKeyCommands = Command.make(
  "session-key",
  {},
  () => Effect.void,
).pipe(
  Command.withDescription("Create and manage session keys"),
  Command.withAlias("sk"),
  Command.withSubcommands([createSessionKeyCommand]),
);
