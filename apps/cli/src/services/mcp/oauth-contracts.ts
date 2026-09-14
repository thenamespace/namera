import { Context, Schema } from "effect";
import type { Effect, Redacted } from "effect";

export class LocalOAuthError extends Schema.TaggedError<LocalOAuthError>()("LocalOAuthError", {
  code: Schema.Literals(["invalid_grant", "invalid_token", "temporarily_unavailable"]),
}) {}

export interface UpstreamCredentials {
  readonly accessToken: Redacted.Redacted<string>;
  readonly refreshToken?: Redacted.Redacted<string>;
  readonly expiresAt: number;
  readonly scopes: readonly string[];
}

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
