import { accountCommands } from "./account";
import { mcpCommands } from "./mcp";
import { sessionKeyCommands } from "./session-key";
import { walletCommands } from "./wallet";

export const subCommands = [
  walletCommands,
  accountCommands,
  sessionKeyCommands,
  mcpCommands,
] as const;
