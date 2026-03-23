import { keystoreCommands } from "./keystore";
import { mcpCommands } from "./mcp";
import { schemaCommand } from "./schema";
import { sessionKeyCommands } from "./session-key";
import { smartAccountCommands } from "./smart-account";

/**
 * Root CLI command set.
 */
export const commands = [
  keystoreCommands,
  smartAccountCommands,
  sessionKeyCommands,
  mcpCommands,
  schemaCommand,
] as const;
