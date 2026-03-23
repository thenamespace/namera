import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createSessionKeyCommand } from "./create";
import { getSessionKeyInfoCommand } from "./info";
import { listSessionKeysCommand } from "./list";
import { removeSessionKeyCommand } from "./remove";
import { getSessionKeyStatusCommand } from "./status";

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
  Command.withSubcommands([
    createSessionKeyCommand,
    listSessionKeysCommand,
    getSessionKeyInfoCommand,
    getSessionKeyStatusCommand,
    removeSessionKeyCommand,
  ]),
);
