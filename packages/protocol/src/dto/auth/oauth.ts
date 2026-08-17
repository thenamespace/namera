import { Schema } from "effect";

import {
  ActorId,
  OAuthAuthorizationId,
  OAuthAuthorizationRequestId,
  OAuthClientId,
  OAuthDeviceAuthorizationId,
  OrganizationId,
  SessionKeyId,
} from "#/common/index";
import {
  OAuthAuthorizationStatus,
  OAuthAuthorizationType,
  OAuthAuthorizationMetadata,
  OAuthGrantType,
  OAuthClientRegistrationType,
  OAuthResponseType,
  OAuthTokenEndpointAuthMethod,
  OAuthScopes,
  TimestampFields,
} from "#/model/index";

import { SessionKeySummaryResponse } from "../session-key/index.js";
import { GetOrganizationMemberResponse } from "./organization/member.js";

const OAuthRegistrationUri = Schema.NonEmptyString.check(
  Schema.isMaxLength(2048, { message: "OAuth registration URIs may not exceed 2048 characters" }),
);

export const OAuthDynamicClientRegistrationRequest = Schema.Struct({
  redirect_uris: Schema.Array(OAuthRegistrationUri).check(
    Schema.isMinLength(1, { message: "At least one redirect URI is required" }),
    Schema.isMaxLength(10, { message: "At most 10 redirect URIs are allowed" }),
  ),
  token_endpoint_auth_method: Schema.optionalKey(OAuthTokenEndpointAuthMethod),
  grant_types: Schema.optionalKey(
    Schema.Array(OAuthGrantType).check(
      Schema.isMinLength(1),
      Schema.isMaxLength(2, { message: "At most two OAuth grant types are allowed" }),
    ),
  ),
  response_types: Schema.optionalKey(
    Schema.Array(OAuthResponseType).check(Schema.isMinLength(1), Schema.isMaxLength(1)),
  ),
  client_name: Schema.optionalKey(
    Schema.NonEmptyString.check(
      Schema.isMaxLength(128, { message: "OAuth client names may not exceed 128 characters" }),
    ),
  ),
  client_uri: Schema.optionalKey(OAuthRegistrationUri),
  logo_uri: Schema.optionalKey(OAuthRegistrationUri),
  application_type: Schema.optionalKey(Schema.Literals(["native", "web"])),
  scope: Schema.optionalKey(
    Schema.NonEmptyString.check(
      Schema.isMaxLength(512, {
        message: "OAuth registration scopes may not exceed 512 characters",
      }),
    ),
  ),
}).annotate({
  identifier: "OAuthDynamicClientRegistrationRequest",
  description: "RFC 7591 metadata for registering a public OAuth client",
});

export const OAuthDynamicClientRegistrationResponse = Schema.Struct({
  client_id: Schema.NonEmptyString,
  client_id_issued_at: Schema.Int.check(Schema.isGreaterThan(0)),
  redirect_uris: Schema.Array(OAuthRegistrationUri),
  token_endpoint_auth_method: OAuthTokenEndpointAuthMethod,
  grant_types: Schema.Array(OAuthGrantType),
  response_types: Schema.Array(OAuthResponseType),
  client_name: Schema.NonEmptyString,
  client_uri: Schema.optionalKey(OAuthRegistrationUri),
  logo_uri: Schema.optionalKey(OAuthRegistrationUri),
  application_type: Schema.Literals(["native", "web"]),
  scope: Schema.optionalKey(Schema.NonEmptyString),
}).annotate({
  identifier: "OAuthDynamicClientRegistrationResponse",
  description: "RFC 7591 public OAuth client registration result",
});

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

export const OAuthDeviceAuthorizationStartRequest = Schema.Struct({
  client_id: Schema.NonEmptyString,
  scope: Schema.NonEmptyString,
  resource: Schema.NonEmptyString,
  device_name: Schema.NonEmptyString.check(Schema.isMaxLength(128)),
  cli_version: Schema.NonEmptyString.check(Schema.isMaxLength(32)),
  platform: Schema.NonEmptyString.check(Schema.isMaxLength(64)),
}).annotate({
  identifier: "OAuthDeviceAuthorizationStartRequest",
  description: "RFC 8628 device authorization request with bounded CLI metadata",
});

export const OAuthDeviceAuthorizationStartResponse = Schema.Struct({
  device_code: Schema.NonEmptyString,
  user_code: Schema.NonEmptyString,
  verification_uri: Schema.NonEmptyString,
  verification_uri_complete: Schema.NonEmptyString,
  expires_in: Schema.Int.check(Schema.isGreaterThan(0)),
  interval: Schema.Int.check(Schema.isGreaterThanOrEqualTo(5)),
}).annotate({
  identifier: "OAuthDeviceAuthorizationStartResponse",
  description: "RFC 8628 device and user codes returned once to the CLI",
});

export const OAuthDeviceAuthorizationResponse = Schema.Struct({
  id: OAuthDeviceAuthorizationId,
  userCode: Schema.NonEmptyString,
  client: OAuthClientResponse,
  requestedScopes: OAuthScopes,
  resource: Schema.NonEmptyString,
  deviceName: Schema.NonEmptyString,
  cliVersion: Schema.NonEmptyString,
  platform: Schema.NonEmptyString,
  expiresAt: Schema.DateTimeUtcFromDate,
}).annotate({
  identifier: "OAuthDeviceAuthorizationResponse",
  description: "A claimed CLI authorization request safe for dashboard consent",
});

export const GetOAuthDeviceAuthorizationRequest = Schema.Struct({
  userCode: Schema.NonEmptyString,
}).annotate({ identifier: "GetOAuthDeviceAuthorizationRequest" });

export const ApproveOAuthDeviceAuthorizationRequest = Schema.Struct({
  deviceAuthorizationId: OAuthDeviceAuthorizationId,
  organizationId: OrganizationId,
  sessionKeyIds: Schema.Array(SessionKeyId).check(
    Schema.isMinLength(1, { message: "At least one session key grant is required" }),
    Schema.isMaxLength(100),
  ),
}).annotate({ identifier: "ApproveOAuthDeviceAuthorizationRequest" });

export const DenyOAuthDeviceAuthorizationRequest = Schema.Struct({
  deviceAuthorizationId: OAuthDeviceAuthorizationId,
}).annotate({ identifier: "DenyOAuthDeviceAuthorizationRequest" });

export const OAuthDeviceAuthorizationDecisionResponse = Schema.Struct({
  status: Schema.Literals(["approved", "denied"]),
}).annotate({ identifier: "OAuthDeviceAuthorizationDecisionResponse" });

export const OAuthAuthorizationResponse = Schema.Struct({
  id: OAuthAuthorizationId,
  organizationId: OrganizationId,
  actorId: ActorId,
  type: OAuthAuthorizationType,
  client: OAuthClientResponse,
  authorizedBy: GetOrganizationMemberResponse,
  scopes: OAuthScopes,
  resource: Schema.NonEmptyString,
  status: OAuthAuthorizationStatus,
  metadata: OAuthAuthorizationMetadata,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  sessionKeys: Schema.Array(SessionKeySummaryResponse),
  ...TimestampFields,
}).annotate({
  identifier: "OAuthAuthorizationResponse",
  description: "An OAuth authorization and its active session-key grants",
});

export const GetOAuthAuthorizationRequest = Schema.Struct({
  authorizationId: OAuthAuthorizationId,
}).annotate({ identifier: "GetOAuthAuthorizationRequest" });

export const GetOAuthAuthorizationResponse = OAuthAuthorizationResponse.annotate({
  identifier: "GetOAuthAuthorizationResponse",
});

export const ListOAuthAuthorizationsResponse = Schema.Array(OAuthAuthorizationResponse).annotate({
  identifier: "ListOAuthAuthorizationsResponse",
});

export const RevokeOAuthAuthorizationRequest = Schema.Struct({
  authorizationId: OAuthAuthorizationId,
}).annotate({ identifier: "RevokeOAuthAuthorizationRequest" });

export const RevokeOAuthAuthorizationResponse = OAuthAuthorizationResponse.annotate({
  identifier: "RevokeOAuthAuthorizationResponse",
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
export type OAuthDynamicClientRegistrationRequest =
  typeof OAuthDynamicClientRegistrationRequest.Type;
export type OAuthDynamicClientRegistrationResponse =
  typeof OAuthDynamicClientRegistrationResponse.Type;
export type OAuthAuthorizationRequestResponse = typeof OAuthAuthorizationRequestResponse.Type;
export type GetOAuthAuthorizationRequestRequest = typeof GetOAuthAuthorizationRequestRequest.Type;
export type GetOAuthAuthorizationRequestResponse = typeof GetOAuthAuthorizationRequestResponse.Type;
export type ApproveOAuthAuthorizationRequest = typeof ApproveOAuthAuthorizationRequest.Type;
export type DenyOAuthAuthorizationRequest = typeof DenyOAuthAuthorizationRequest.Type;
export type OAuthAuthorizationRedirectResponse = typeof OAuthAuthorizationRedirectResponse.Type;
export type OAuthDeviceAuthorizationStartRequest = typeof OAuthDeviceAuthorizationStartRequest.Type;
export type OAuthDeviceAuthorizationStartResponse =
  typeof OAuthDeviceAuthorizationStartResponse.Type;
export type OAuthDeviceAuthorizationResponse = typeof OAuthDeviceAuthorizationResponse.Type;
export type GetOAuthDeviceAuthorizationRequest = typeof GetOAuthDeviceAuthorizationRequest.Type;
export type ApproveOAuthDeviceAuthorizationRequest =
  typeof ApproveOAuthDeviceAuthorizationRequest.Type;
export type DenyOAuthDeviceAuthorizationRequest = typeof DenyOAuthDeviceAuthorizationRequest.Type;
export type OAuthDeviceAuthorizationDecisionResponse =
  typeof OAuthDeviceAuthorizationDecisionResponse.Type;
export type OAuthAuthorizationResponse = typeof OAuthAuthorizationResponse.Type;
export type GetOAuthAuthorizationRequest = typeof GetOAuthAuthorizationRequest.Type;
export type GetOAuthAuthorizationResponse = typeof GetOAuthAuthorizationResponse.Type;
export type ListOAuthAuthorizationsResponse = typeof ListOAuthAuthorizationsResponse.Type;
export type RevokeOAuthAuthorizationRequest = typeof RevokeOAuthAuthorizationRequest.Type;
export type RevokeOAuthAuthorizationResponse = typeof RevokeOAuthAuthorizationResponse.Type;
export type OAuthTokenResponse = typeof OAuthTokenResponse.Type;
