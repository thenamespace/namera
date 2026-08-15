import { Schema } from "effect";

import { ActorId, OrganizationId, SessionKeyGrantId } from "#/common/index";

import { SessionKeySummaryResponse } from "./session-key/index.js";

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
