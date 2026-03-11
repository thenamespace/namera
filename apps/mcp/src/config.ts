import { Config } from "effect";
export const McpConfig = Config.all({});

export type McpConfigValues = Config.Config.Success<typeof McpConfig>;
