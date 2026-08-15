import { Schema } from "effect";

export const OAuthScope = Schema.Literals(["mcp:read", "mcp:execute", "offline_access"]);
export const OAuthScopes = Schema.Array(OAuthScope);

export type OAuthScope = typeof OAuthScope.Type;
export type OAuthScopes = typeof OAuthScopes.Type;
