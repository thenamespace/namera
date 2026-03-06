import { Config, type Effect } from "effect";
export const McpConfig = Config.all({});

export type McpConfigValues = Effect.Success<
  ReturnType<typeof McpConfig.asEffect>
>;
