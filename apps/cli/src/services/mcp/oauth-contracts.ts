import { Context, Schema } from "effect";
import type { Effect, Redacted } from "effect";

import {
  LocalMcpCodeChallenge,
  LocalMcpCodeVerifier,
  LocalMcpRedirectUri,
} from "./transport-security.js";

const BoundedString = Schema.NonEmptyString.check(Schema.isMaxLength(2048));
export const LocalOAuthScope = Schema.Literals(["mcp:read", "mcp:execute", "offline_access"]);

export const parseLocalOAuthScopes = (scope: string) => {
  const scopes = [...new Set(scope.split(/\s+/).filter(Boolean))];
  return scopes.includes("mcp:read") && scopes.every(Schema.is(LocalOAuthScope))
    ? scopes
    : undefined;
};

export const LocalOAuthRegistration = Schema.Struct({
  client_name: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(128))),
  redirect_uris: Schema.Array(LocalMcpRedirectUri).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(10),
  ),
  token_endpoint_auth_method: Schema.optionalKey(Schema.Literal("none")),
  grant_types: Schema.optionalKey(
    Schema.Array(Schema.Literals(["authorization_code", "refresh_token"])).check(
      Schema.isMinLength(1),
      Schema.isMaxLength(2),
      Schema.makeFilter(
        (types) => types.includes("authorization_code") && new Set(types).size === types.length,
      ),
    ),
  ),
  response_types: Schema.optionalKey(
    Schema.Array(Schema.Literal("code")).check(Schema.isMinLength(1), Schema.isMaxLength(1)),
  ),
});

export const LocalOAuthAuthorization = Schema.Struct({
  client_id: BoundedString,
  redirect_uri: LocalMcpRedirectUri,
  resource: BoundedString,
  response_type: Schema.Literal("code"),
  code_challenge_method: Schema.Literal("S256"),
  code_challenge: LocalMcpCodeChallenge,
  scope: Schema.NonEmptyString.check(Schema.isMaxLength(128)),
  state: Schema.optionalKey(BoundedString),
});

export const LocalOAuthCodeExchange = Schema.Struct({
  grant_type: Schema.Literal("authorization_code"),
  client_id: BoundedString,
  redirect_uri: LocalMcpRedirectUri,
  resource: BoundedString,
  code: BoundedString,
  code_verifier: LocalMcpCodeVerifier,
});

export const LocalOAuthRefresh = Schema.Struct({
  grant_type: Schema.Literal("refresh_token"),
  client_id: BoundedString,
  resource: BoundedString,
  refresh_token: BoundedString,
  scope: Schema.optionalKey(Schema.NonEmptyString.check(Schema.isMaxLength(128))),
});

export class LocalOAuthError extends Schema.TaggedError<LocalOAuthError>()("LocalOAuthError", {
  code: Schema.Literals([
    "invalid_request",
    "invalid_client",
    "invalid_grant",
    "invalid_scope",
    "invalid_target",
    "invalid_token",
    "temporarily_unavailable",
  ]),
}) {}

export interface UpstreamCredentials {
  readonly accessToken: Redacted.Redacted<string>;
  readonly refreshToken?: Redacted.Redacted<string>;
  readonly expiresAt: number;
  readonly scopes: readonly string[];
}

/** Only this adapter talks to the configured Namera issuer, never to agent URLs. */
export class McpOAuthUpstream extends Context.Service<
  McpOAuthUpstream,
  {
    readonly register: (name: string) => Effect.Effect<string, LocalOAuthError>;
    readonly exchange: (input: {
      readonly clientId: string;
      readonly code: string;
      readonly verifier: Redacted.Redacted<string>;
    }) => Effect.Effect<UpstreamCredentials, LocalOAuthError>;
    readonly refresh: (input: {
      readonly clientId: string;
      readonly refreshToken: Redacted.Redacted<string>;
      readonly scopes: readonly string[];
    }) => Effect.Effect<UpstreamCredentials, LocalOAuthError>;
    readonly revoke: (
      clientId: string,
      token: Redacted.Redacted<string>,
    ) => Effect.Effect<void, LocalOAuthError>;
  }
>()("@namera-ai/cli/McpOAuthUpstream") {}
