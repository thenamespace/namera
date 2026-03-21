import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

/**
 * Command group for session-key related operations.
 */
export const sessionKeyCommands = Command.make(
  "session-key",
  {},
  () => Effect.void,
).pipe(
  Command.withAlias("sk"),
  Command.withDescription("Session Key management commands."),
  Command.withSubcommands([]),
);
