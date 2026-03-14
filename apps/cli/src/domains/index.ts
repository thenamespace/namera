import { accountCommands } from "./account";
import { sessionKeyCommands } from "./session-key";
import { walletCommands } from "./wallet";

export const subCommands = [
  walletCommands,
  accountCommands,
  sessionKeyCommands,
] as const;
