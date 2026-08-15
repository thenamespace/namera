import { Context, Effect, Metric, Schema } from "effect";
import { McpSchema, McpServer, Tool } from "effect/unstable/ai";

import {
  ListMcpSessionKeyGrantsResponse,
  type ListMcpSessionKeyGrantsResponse as ListMcpSessionKeyGrantsResponseType,
} from "@namera-ai/protocol/dto";
import { mcpToolCalls } from "@namera-ai/telemetry";

import { CurrentMcpPrincipal } from "../principal.js";

const ListSessionKeyGrants = Tool.make("list_session_key_grants", {
  description:
    "List the active session-key grants and session keys delegated to this MCP authorization.",
  success: ListMcpSessionKeyGrantsResponse,
});

export const SessionKeyGrantTools = Effect.gen(function* () {
  const server = yield* McpServer.McpServer;
  yield* server.addTool({
    tool: new McpSchema.Tool({
      name: ListSessionKeyGrants.name,
      description: ListSessionKeyGrants.description,
      inputSchema: Tool.getJsonSchema(ListSessionKeyGrants),
      outputSchema: Tool.getJsonSchemaFromSchema(ListMcpSessionKeyGrantsResponse),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    }),
    annotations: Context.empty(),
    handle: () =>
      Effect.gen(function* () {
        const principal = yield* CurrentMcpPrincipal;
        if (principal === null) {
          yield* Metric.update(
            Metric.withAttributes(mcpToolCalls, {
              tool: "list_session_key_grants",
              result: "unauthorized",
            }),
            1,
          );
          return new McpSchema.CallToolResult({
            isError: true,
            content: [{ type: "text", text: "The MCP authorization is not available." }],
          });
        }

        const result: ListMcpSessionKeyGrantsResponseType = {
          grants: principal.grants.map(({ grant, sessionKey }) => ({
            id: grant.id,
            organizationId: grant.organizationId,
            actorId: grant.actorId,
            sessionKey: {
              id: sessionKey.id,
              organizationId: sessionKey.organizationId,
              walletId: sessionKey.walletId,
              namespace: sessionKey.namespace,
              metadata: sessionKey.metadata,
              policies: sessionKey.policies,
              policyHash: sessionKey.policyHash,
              status: sessionKey.status,
              revokedAt: sessionKey.revokedAt,
              createdAt: sessionKey.createdAt,
            },
            createdAt: grant.createdAt,
          })),
        };
        const encoded = yield* Schema.encodeUnknownEffect(ListMcpSessionKeyGrantsResponse)(result);
        yield* Metric.update(
          Metric.withAttributes(mcpToolCalls, {
            tool: "list_session_key_grants",
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
              tool: "list_session_key_grants",
              result: "error",
            }),
            1,
          ).pipe(
            Effect.as(
              new McpSchema.CallToolResult({
                isError: true,
                content: [{ type: "text", text: "The session-key grants could not be listed." }],
              }),
            ),
          ),
        ),
      ),
  });
});
