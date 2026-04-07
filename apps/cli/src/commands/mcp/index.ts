import { Effect } from "effect";
import { CliError, Command } from "effect/unstable/cli";

import { startMcpCommand } from "./start";

export const mcpCommands = Command.make("mcp", {}, () =>
  Effect.fail(
    new CliError.ShowHelp({
      commandPath: ["namera", "mcp"],
      errors: [],
    }),
  ),
).pipe(
  Command.withDescription("Start and manage the Namera MCP server"),
  Command.withSubcommands([startMcpCommand]),
);
