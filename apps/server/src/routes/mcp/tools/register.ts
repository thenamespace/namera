import { Context, Effect, Metric, Schema } from "effect";
import { McpSchema, McpServer, Tool } from "effect/unstable/ai";

import type { OAuthScope } from "@namera-ai/protocol/model";
import { mcpToolCalls } from "@namera-ai/telemetry";

import { CurrentMcpPrincipal, type McpPrincipal } from "../principal.js";

type ToolHints = {
  readonly readOnly: boolean;
  readonly destructive: boolean;
  readonly idempotent: boolean;
  readonly openWorld: boolean;
};

// MCP clients commonly require the root tool schema to be an object. Effect's
// JSON Schema encoder emits annotated structs as a root `$ref`, so inline only
// that root while retaining `$defs` for nested reusable schemas.
const inlineRootReference = (schema: ReturnType<typeof Tool.getJsonSchema>) => {
  const reference = Reflect.get(schema, "$ref");
  const definitions = Reflect.get(schema, "$defs");
  if (
    typeof reference !== "string" ||
    !reference.startsWith("#/$defs/") ||
    typeof definitions !== "object" ||
    definitions === null
  ) {
    return schema;
  }

  const definition = Reflect.get(definitions, reference.slice("#/$defs/".length));
  return typeof definition === "object" && definition !== null
    ? { ...definition, $defs: definitions }
    : schema;
};

export const registerMcpTool = <T extends Tool.Any, E>(options: {
  readonly tool: T;
  readonly requiredScope: Extract<OAuthScope, "mcp:read" | "mcp:execute">;
  readonly hints: ToolHints;
  readonly errorMessage: string;
  readonly handle: (
    input: Tool.Parameters<T>,
    principal: McpPrincipal,
  ) => Effect.Effect<Tool.Success<T>, E>;
}) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;

    yield* server.addTool({
      tool: new McpSchema.Tool({
        name: options.tool.name,
        description: options.tool.description,
        inputSchema: inlineRootReference(Tool.getJsonSchema(options.tool)),
        outputSchema: inlineRootReference(Tool.getJsonSchemaFromSchema(options.tool.successSchema)),
        annotations: {
          readOnlyHint: options.hints.readOnly,
          destructiveHint: options.hints.destructive,
          idempotentHint: options.hints.idempotent,
          openWorldHint: options.hints.openWorld,
        },
      }),
      annotations: Context.empty(),
      handle: (payload) =>
        Effect.gen(function* () {
          const principal = yield* CurrentMcpPrincipal;
          if (principal === null) {
            yield* Metric.update(
              Metric.withAttributes(mcpToolCalls, {
                tool: options.tool.name,
                result: "unauthorized",
              }),
              1,
            );

            return new McpSchema.CallToolResult({
              isError: true,
              content: [{ type: "text", text: "The MCP authorization is not available." }],
            });
          }

          if (!principal.scopes.includes(options.requiredScope)) {
            yield* Metric.update(
              Metric.withAttributes(mcpToolCalls, {
                tool: options.tool.name,
                result: "insufficient_scope",
              }),
              1,
            );

            return new McpSchema.CallToolResult({
              isError: true,
              content: [
                {
                  type: "text",
                  text: `This tool requires the ${options.requiredScope} OAuth scope.`,
                },
              ],
            });
          }

          const input = yield* Schema.decodeUnknownEffect(
            options.tool.parametersSchema as Schema.Codec<
              Tool.Parameters<T>,
              unknown,
              never,
              never
            >,
          )(payload);
          const result = yield* options.handle(input, principal);
          const encoded = yield* Schema.encodeUnknownEffect(
            options.tool.successSchema as Schema.Codec<Tool.Success<T>, unknown, never, never>,
          )(result);

          yield* Metric.update(
            Metric.withAttributes(mcpToolCalls, {
              tool: options.tool.name,
              result: "success",
            }),
            1,
          );

          return new McpSchema.CallToolResult({
            structuredContent: encoded,
            content: [{ type: "text", text: JSON.stringify(encoded) }],
          });
        }).pipe(
          Effect.catch(() =>
            Metric.update(
              Metric.withAttributes(mcpToolCalls, {
                tool: options.tool.name,
                result: "error",
              }),
              1,
            ).pipe(
              Effect.as(
                new McpSchema.CallToolResult({
                  isError: true,
                  content: [{ type: "text", text: options.errorMessage }],
                }),
              ),
            ),
          ),
        ),
    });
  });

export const readOnlyHints = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: false,
} as const;

export const executionHints = {
  readOnly: false,
  destructive: true,
  idempotent: true,
  openWorld: true,
} as const;

export const signingHints = {
  readOnly: false,
  destructive: false,
  idempotent: false,
  openWorld: false,
} as const;
