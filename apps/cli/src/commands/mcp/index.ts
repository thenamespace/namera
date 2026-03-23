import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { startMcpCommand } from "./start";

export const mcpCommands = Command.make("mcp", {}, () => Effect.void).pipe(
  Command.withDescription("Start and manage the Namera MCP server"),
  Command.withSubcommands([startMcpCommand]),
);
