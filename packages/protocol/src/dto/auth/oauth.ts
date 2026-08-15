import { Schema } from "effect";

import {
  ActorId,
  McpAuthorizationId,
  OAuthAuthorizationRequestId,
  OAuthClientId,
  OrganizationId,
  SessionKeyId,
} from "#/common/index";
import {
  McpAuthorizationStatus,
  OAuthClientRegistrationType,
  OAuthScopes,
  TimestampFields,
} from "#/model/index";

import { SessionKeySummaryResponse } from "../session-key/index.js";
import { GetOrganizationMemberResponse } from "./organization/member.js";

export const OAuthClientResponse = Schema.Struct({
  id: OAuthClientId,
  clientId: Schema.NonEmptyString,
  registrationType: OAuthClientRegistrationType,
  clientName: Schema.NonEmptyString,
  clientUri: Schema.NullOr(Schema.String),
  logoUri: Schema.NullOr(Schema.String),
}).annotate({
  identifier: "OAuthClientResponse",
  description: "Safe display metadata for an OAuth client",
});

export const OAuthAuthorizationRequestResponse = Schema.Struct({
  id: OAuthAuthorizationRequestId,
  client: OAuthClientResponse,
  redirectUri: Schema.NonEmptyString,
  resource: Schema.NonEmptyString,
  requestedScopes: OAuthScopes,
  expiresAt: Schema.DateTimeUtcFromDate,
  createdAt: Schema.DateTimeUtcFromDate,
}).annotate({
  identifier: "OAuthAuthorizationRequestResponse",
  description: "A pending OAuth request safe to display on the consent screen",
});

export const GetOAuthAuthorizationRequestRequest = Schema.Struct({
  requestId: OAuthAuthorizationRequestId,
}).annotate({ identifier: "GetOAuthAuthorizationRequestRequest" });

export const GetOAuthAuthorizationRequestResponse = OAuthAuthorizationRequestResponse.annotate({
  identifier: "GetOAuthAuthorizationRequestResponse",
});

export const ApproveOAuthAuthorizationRequest = Schema.Struct({
  requestId: OAuthAuthorizationRequestId,
  organizationId: OrganizationId,
  sessionKeyIds: Schema.Array(SessionKeyId).check(
    Schema.isMinLength(1, { message: "At least one session key grant is required" }),
    Schema.isMaxLength(100, { message: "At most 100 session key grants are allowed" }),
  ),
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).annotate({
  identifier: "ApproveOAuthAuthorizationRequest",
  description: "Approve OAuth access and grant selected session keys to the MCP actor",
});

export const DenyOAuthAuthorizationRequest = Schema.Struct({
  requestId: OAuthAuthorizationRequestId,
}).annotate({ identifier: "DenyOAuthAuthorizationRequest" });

export const OAuthAuthorizationRedirectResponse = Schema.Struct({
  redirectUrl: Schema.NonEmptyString,
}).annotate({
  identifier: "OAuthAuthorizationRedirectResponse",
  description: "Validated OAuth client callback URL",
});

export const McpAuthorizationResponse = Schema.Struct({
  id: McpAuthorizationId,
  organizationId: OrganizationId,
  actorId: ActorId,
  client: OAuthClientResponse,
  authorizedBy: GetOrganizationMemberResponse,
  scopes: OAuthScopes,
  resource: Schema.NonEmptyString,
  status: McpAuthorizationStatus,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  sessionKeys: Schema.Array(SessionKeySummaryResponse),
  ...TimestampFields,
}).annotate({
  identifier: "McpAuthorizationResponse",
  description: "An MCP OAuth authorization and its active session-key grants",
});

export const GetMcpAuthorizationRequest = Schema.Struct({
  authorizationId: McpAuthorizationId,
}).annotate({ identifier: "GetMcpAuthorizationRequest" });

export const GetMcpAuthorizationResponse = McpAuthorizationResponse.annotate({
  identifier: "GetMcpAuthorizationResponse",
});

export const ListMcpAuthorizationsResponse = Schema.Array(McpAuthorizationResponse).annotate({
  identifier: "ListMcpAuthorizationsResponse",
});

export const RevokeMcpAuthorizationRequest = Schema.Struct({
  authorizationId: McpAuthorizationId,
}).annotate({ identifier: "RevokeMcpAuthorizationRequest" });

export const RevokeMcpAuthorizationResponse = McpAuthorizationResponse.annotate({
  identifier: "RevokeMcpAuthorizationResponse",
});

export const OAuthTokenResponse = Schema.Struct({
  token_type: Schema.Literal("Bearer"),
  access_token: Schema.NonEmptyString,
  expires_in: Schema.Int.check(Schema.isGreaterThan(0)),
  refresh_token: Schema.optionalKey(Schema.NonEmptyString),
  scope: Schema.NonEmptyString,
}).annotate({
  identifier: "OAuthTokenResponse",
  description: "OAuth bearer credentials returned by the token endpoint",
});

export type OAuthClientResponse = typeof OAuthClientResponse.Type;
export type OAuthAuthorizationRequestResponse = typeof OAuthAuthorizationRequestResponse.Type;
export type GetOAuthAuthorizationRequestRequest = typeof GetOAuthAuthorizationRequestRequest.Type;
export type GetOAuthAuthorizationRequestResponse = typeof GetOAuthAuthorizationRequestResponse.Type;
export type ApproveOAuthAuthorizationRequest = typeof ApproveOAuthAuthorizationRequest.Type;
export type DenyOAuthAuthorizationRequest = typeof DenyOAuthAuthorizationRequest.Type;
export type OAuthAuthorizationRedirectResponse = typeof OAuthAuthorizationRedirectResponse.Type;
export type McpAuthorizationResponse = typeof McpAuthorizationResponse.Type;
export type GetMcpAuthorizationRequest = typeof GetMcpAuthorizationRequest.Type;
export type GetMcpAuthorizationResponse = typeof GetMcpAuthorizationResponse.Type;
export type ListMcpAuthorizationsResponse = typeof ListMcpAuthorizationsResponse.Type;
export type RevokeMcpAuthorizationRequest = typeof RevokeMcpAuthorizationRequest.Type;
export type RevokeMcpAuthorizationResponse = typeof RevokeMcpAuthorizationResponse.Type;
export type OAuthTokenResponse = typeof OAuthTokenResponse.Type;
