import { keystoreCommands } from "./keystore";
import { schemaCommand } from "./schema";

/**
 * Root CLI command set.
 */
export const commands = [keystoreCommands, schemaCommand] as const;
