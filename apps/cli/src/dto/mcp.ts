import { Schema } from "effect";

export const StartMcpServerParams = Schema.Struct({
  smartAccountAlias: Schema.String.annotate({
    description: "The alias of the smart account to use for the MCP server",
  }),
  transport: Schema.Literals(["http", "stdio"]).annotate({
    description: "The transport to use for the MCP server",
  }),
  port: Schema.optional(
    Schema.Int.check(Schema.makeFilter((v) => v > 0 && v < 65_536)),
  ).annotate({
    description: "The port to use for the MCP server when using http transport",
  }),
  sessionKeys: Schema.mutableKey(Schema.Record(Schema.String, Schema.String)),
});

export type StartMcpServerParams = typeof StartMcpServerParams.Type;
