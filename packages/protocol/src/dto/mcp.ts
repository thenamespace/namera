import { Schema } from "effect";

import { ActorId, OrganizationId, SessionKeyGrantId } from "#/common/index";

import { ExecuteRequest } from "./execution.js";
import { SessionKeySummaryResponse } from "./session-key/index.js";

export const McpExecuteRequest = Schema.Struct({
  request: ExecuteRequest,
}).annotate({
  identifier: "McpExecuteRequest",
  description: "Execute a namespace-specific transaction through delegated session keys",
});

export const McpSessionKeyGrantResponse = Schema.Struct({
  id: SessionKeyGrantId,
  organizationId: OrganizationId,
  actorId: ActorId,
  sessionKey: SessionKeySummaryResponse,
  createdAt: Schema.DateTimeUtcFromDate,
}).annotate({
  identifier: "McpSessionKeyGrantResponse",
  description: "An active session-key grant visible to the current MCP authorization",
});

export const ListMcpSessionKeyGrantsResponse = Schema.Struct({
  grants: Schema.Array(McpSessionKeyGrantResponse),
}).annotate({
  identifier: "ListMcpSessionKeyGrantsResponse",
  description: "Active session-key grants delegated to the current MCP authorization",
});

export type McpSessionKeyGrantResponse = typeof McpSessionKeyGrantResponse.Type;
export type ListMcpSessionKeyGrantsResponse = typeof ListMcpSessionKeyGrantsResponse.Type;
export type McpExecuteRequest = typeof McpExecuteRequest.Type;
