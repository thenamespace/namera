import { Clock, Effect, FileSystem, Layer, Redacted, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpIncomingMessage,
} from "effect/unstable/http";

import {
  OAuthDynamicClientRegistrationResponse,
  OAuthTokenResponse,
} from "@namera-ai/protocol/dto";

import { LocalOAuthError, McpOAuthUpstream, type UpstreamCredentials } from "./oauth-contracts.js";

export const mcpOAuthUpstreamLayer = (config: {
  readonly callback: string;
  readonly apiOrigin: string;
}) =>
  Layer.effect(
    McpOAuthUpstream,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const requestJson = Effect.fn("McpOAuthUpstream.request")(
        function* (request: HttpClientRequest.HttpClientRequest) {
          const response = yield* client
            .execute(request)
            .pipe(Effect.mapError(() => new LocalOAuthError({ code: "temporarily_unavailable" })));
          if (response.status < 200 || response.status >= 300) {
            return yield* new LocalOAuthError({
              code:
                response.status >= 500 || response.status === 429
                  ? "temporarily_unavailable"
                  : "invalid_grant",
            });
          }
          return yield* response.json.pipe(
            Effect.mapError(() => new LocalOAuthError({ code: "temporarily_unavailable" })),
          );
        },
        Effect.provideService(FetchHttpClient.RequestInit, { redirect: "error" }),
        Effect.provideService(HttpIncomingMessage.MaxBodySize, FileSystem.KiB(32)),
        Effect.timeout("15 seconds"),
        Effect.catchTag("TimeoutError", () =>
          Effect.fail(new LocalOAuthError({ code: "temporarily_unavailable" })),
        ),
        Effect.scoped,
      );

      const tokenRequest = Effect.fn("McpOAuthUpstream.token")(function* (
        body: Record<string, string>,
      ) {
        const json = yield* requestJson(
          HttpClientRequest.post(`${config.apiOrigin}/oauth/token`).pipe(
            HttpClientRequest.bodyUrlParams({ ...body, resource: config.apiOrigin }),
          ),
        );
        const token = yield* Schema.decodeUnknownEffect(OAuthTokenResponse)(json).pipe(
          Effect.mapError(() => new LocalOAuthError({ code: "temporarily_unavailable" })),
        );
        const now = yield* Clock.currentTimeMillis;
        return {
          accessToken: Redacted.make(token.access_token),
          ...(token.refresh_token === undefined
            ? {}
            : { refreshToken: Redacted.make(token.refresh_token) }),
          expiresAt: now + token.expires_in * 1000,
          scopes: token.scope.split(/\s+/).filter(Boolean),
        } satisfies UpstreamCredentials;
      });

      return McpOAuthUpstream.of({
        register: Effect.fn("McpOAuthUpstream.register")(function* (name) {
          const json = yield* requestJson(
            HttpClientRequest.post(`${config.apiOrigin}/oauth/register`).pipe(
              HttpClientRequest.bodyJsonUnsafe({
                client_name: `Namera local MCP: ${name}`.slice(0, 128),
                redirect_uris: [config.callback],
                token_endpoint_auth_method: "none",
                grant_types: ["authorization_code", "refresh_token"],
                response_types: ["code"],
                application_type: "native",
              }),
            ),
          );
          const registered = yield* Schema.decodeUnknownEffect(
            OAuthDynamicClientRegistrationResponse,
          )(json).pipe(
            Effect.mapError(() => new LocalOAuthError({ code: "temporarily_unavailable" })),
          );
          if (
            registered.redirect_uris.length !== 1 ||
            registered.redirect_uris[0] !== config.callback ||
            registered.token_endpoint_auth_method !== "none"
          ) {
            return yield* new LocalOAuthError({ code: "temporarily_unavailable" });
          }
          return registered.client_id;
        }),
        exchange: ({ clientId, code, verifier }) =>
          tokenRequest({
            grant_type: "authorization_code",
            client_id: clientId,
            redirect_uri: config.callback,
            code,
            code_verifier: Redacted.value(verifier),
          }),
        refresh: ({ clientId, refreshToken, scopes }) =>
          tokenRequest({
            grant_type: "refresh_token",
            client_id: clientId,
            refresh_token: Redacted.value(refreshToken),
            scope: scopes.join(" "),
          }),
        revoke: Effect.fn("McpOAuthUpstream.revoke")(
          function* (clientId, token) {
            // The revocation response is empty; do not attempt JSON decoding.
            const response = yield* client
              .execute(
                HttpClientRequest.post(`${config.apiOrigin}/oauth/revoke`).pipe(
                  HttpClientRequest.bodyUrlParams({
                    client_id: clientId,
                    token: Redacted.value(token),
                  }),
                ),
              )
              .pipe(
                Effect.mapError(() => new LocalOAuthError({ code: "temporarily_unavailable" })),
              );
            if (response.status < 200 || response.status >= 300)
              return yield* new LocalOAuthError({ code: "temporarily_unavailable" });
          },
          Effect.provideService(FetchHttpClient.RequestInit, { redirect: "error" }),
          Effect.timeout("15 seconds"),
          Effect.catchTag("TimeoutError", () =>
            Effect.fail(new LocalOAuthError({ code: "temporarily_unavailable" })),
          ),
          Effect.scoped,
        ),
      });
    }),
  );
