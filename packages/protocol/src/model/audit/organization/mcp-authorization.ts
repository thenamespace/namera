import { Schema } from "effect";

import { McpAuthorizationId, OAuthClientId, SessionKeyId } from "#/common/index";

const McpAuthorizationResource = {
  resourceType: Schema.Literal("mcp-authorization"),
  resourceId: McpAuthorizationId,
};

export const McpAuthorizationApprovedEventData = Schema.Struct({
  event: Schema.Literal("mcp_authorization.approved"),
  ...McpAuthorizationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
    clientId: OAuthClientId,
    sessionKeyIds: Schema.Array(SessionKeyId),
  }),
});

export const McpAuthorizationRevokedEventData = Schema.Struct({
  event: Schema.Literal("mcp_authorization.revoked"),
  ...McpAuthorizationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
    clientId: OAuthClientId,
    sessionKeyIds: Schema.Array(SessionKeyId),
  }),
});
