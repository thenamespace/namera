import { Schema } from "effect";

export const OAuthScope = Schema.Literals([
  "mcp:read",
  "mcp:execute",
  "wallet:read",
  "session-key:read",
  "execution:read",
  "execution:execute",
  "signature:create",
  "offline_access",
]);
export const OAuthScopes = Schema.Array(OAuthScope);

export const OAuthPkceCodeChallenge = Schema.String.check(
  Schema.isBetweenLength(43, 43),
  Schema.isPattern(/^[A-Za-z0-9_-]+$/),
);

export const OAuthPkceCodeVerifier = Schema.String.check(
  Schema.isBetweenLength(43, 128),
  Schema.isPattern(/^[A-Za-z0-9._~-]+$/),
);

export type OAuthScope = typeof OAuthScope.Type;
export type OAuthScopes = typeof OAuthScopes.Type;
export type OAuthPkceCodeChallenge = typeof OAuthPkceCodeChallenge.Type;
export type OAuthPkceCodeVerifier = typeof OAuthPkceCodeVerifier.Type;
