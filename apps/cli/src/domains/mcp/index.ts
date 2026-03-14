import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { startMcpCommand } from "./start";

export const mcpCommands = Command.make("mcp", {}, () => Effect.void).pipe(
  Command.withDescription("MCP utilities."),
  Command.withSubcommands([startMcpCommand]),
);
