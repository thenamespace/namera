import { accountCommands } from "./account";
import { walletCommands } from "./wallet";

export const subCommands = [walletCommands, accountCommands] as const;
