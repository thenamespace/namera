import { Effect, Layer, Schema, Stream } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { localMcpResponseHeaders } from "./http-security.js";
import { LocalMcpOAuth } from "./oauth-broker.js";
import { LocalOAuthError } from "./oauth-contracts.js";
import type { LocalMcpUrls } from "./transport-security.js";

const errorResponse = (code: string, status = 400) =>
  HttpServerResponse.jsonUnsafe({ error: code }, { status, headers: localMcpResponseHeaders });

const parameters = (params: URLSearchParams) => {
  if ([...new Set(params.keys())].some((key) => params.getAll(key).length !== 1)) return undefined;
  return Object.fromEntries(params);
};

const queryParameters = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const params = parameters(new URLSearchParams(request.url.split("?").slice(1).join("?")));
  if (!params) return yield* new LocalOAuthError({ code: "invalid_request" });
  return params;
});

const bodyText = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  // Bound the stream explicitly: Web Request adapters do not honor MaxBodySize
  // when their text/json convenience getters consume the body.
  const body = yield* request.stream.pipe(
    Stream.runFoldEffect(
      () => ({ size: 0, chunks: [] as readonly Uint8Array[] }),
      (state, chunk) =>
        state.size + chunk.length > 32 * 1024
          ? Effect.fail(new LocalOAuthError({ code: "invalid_request" }))
          : Effect.succeed({ size: state.size + chunk.length, chunks: [...state.chunks, chunk] }),
    ),
    Effect.timeout("10 seconds"),
    Effect.mapError(() => new LocalOAuthError({ code: "invalid_request" })),
  );
  return Buffer.concat(body.chunks).toString("utf8");
});

const formParameters = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  if (
    request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/x-www-form-urlencoded"
  )
    return yield* new LocalOAuthError({ code: "invalid_request" });
  const body = yield* bodyText;
  const params = parameters(new URLSearchParams(body));
  if (!params) return yield* new LocalOAuthError({ code: "invalid_request" });
  return params;
});

const respond = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  map: (value: A) => HttpServerResponse.HttpServerResponse,
) =>
  effect.pipe(
    Effect.map(map),
    Effect.catch((error) =>
      Effect.succeed(
        error instanceof LocalOAuthError
          ? errorResponse(error.code, error.code === "temporarily_unavailable" ? 503 : 400)
          : errorResponse("temporarily_unavailable", 503),
      ),
    ),
  );

const redirect = (location: string) =>
  HttpServerResponse.redirect(location, { headers: localMcpResponseHeaders });
const json = (value: unknown) =>
  HttpServerResponse.jsonUnsafe(value, { headers: localMcpResponseHeaders });

export const localMcpOAuthRoutes = (urls: LocalMcpUrls) =>
  Layer.mergeAll(
    HttpRouter.add(
      "GET",
      "/.well-known/oauth-authorization-server",
      Effect.succeed(
        json({
          issuer: urls.origin,
          authorization_endpoint: `${urls.origin}/oauth/authorize`,
          registration_endpoint: `${urls.origin}/oauth/register`,
          token_endpoint: `${urls.origin}/oauth/token`,
          revocation_endpoint: `${urls.origin}/oauth/revoke`,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
          scopes_supported: ["mcp:read", "mcp:execute", "offline_access"],
        }),
      ),
    ),
    HttpRouter.add(
      "GET",
      "/.well-known/oauth-protected-resource/mcp",
      Effect.succeed(
        json({
          resource: urls.resource,
          authorization_servers: [urls.origin],
          bearer_methods_supported: ["header"],
          scopes_supported: ["mcp:read", "mcp:execute"],
        }),
      ),
    ),
    HttpRouter.add("POST", "/oauth/register", (request) =>
      respond(
        Effect.gen(function* () {
          if (
            request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !==
            "application/json"
          )
            return yield* new LocalOAuthError({ code: "invalid_request" });
          const body = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(
            yield* bodyText,
          ).pipe(Effect.mapError(() => new LocalOAuthError({ code: "invalid_request" })));
          return yield* (yield* LocalMcpOAuth).register(body);
        }),
        (value) =>
          HttpServerResponse.jsonUnsafe(value, { status: 201, headers: localMcpResponseHeaders }),
      ),
    ),
    HttpRouter.add(
      "GET",
      "/oauth/authorize",
      respond(
        Effect.gen(function* () {
          return yield* (yield* LocalMcpOAuth).begin(yield* queryParameters);
        }),
        redirect,
      ),
    ),
    HttpRouter.add(
      "GET",
      "/oauth/callback",
      respond(
        Effect.gen(function* () {
          const params = yield* queryParameters;
          const state = params.state;
          if (
            !state ||
            state.length > 2048 ||
            (params.code === undefined) === (params.error === undefined)
          )
            return yield* new LocalOAuthError({ code: "invalid_request" });
          const broker = yield* LocalMcpOAuth;
          if (params.error !== undefined) return yield* broker.deny(state);
          if (!params.code || params.code.length > 2048)
            return yield* new LocalOAuthError({ code: "invalid_request" });
          return yield* broker.callback(state, params.code);
        }),
        redirect,
      ),
    ),
    HttpRouter.add(
      "POST",
      "/oauth/token",
      respond(
        Effect.gen(function* () {
          const params = yield* formParameters;
          const broker = yield* LocalMcpOAuth;
          if (params.grant_type === "authorization_code") return yield* broker.exchange(params);
          if (params.grant_type === "refresh_token") return yield* broker.refresh(params);
          return yield* new LocalOAuthError({ code: "invalid_request" });
        }),
        json,
      ),
    ),
    HttpRouter.add(
      "POST",
      "/oauth/revoke",
      respond(
        Effect.gen(function* () {
          const params = yield* Schema.decodeUnknownEffect(
            Schema.Struct({
              client_id: Schema.NonEmptyString.check(Schema.isMaxLength(2048)),
              token: Schema.NonEmptyString.check(Schema.isMaxLength(2048)),
            }),
          )(yield* formParameters).pipe(
            Effect.mapError(() => new LocalOAuthError({ code: "invalid_request" })),
          );
          yield* (yield* LocalMcpOAuth).revoke(params.client_id, params.token);
        }),
        () => HttpServerResponse.empty({ status: 200, headers: localMcpResponseHeaders }),
      ),
    ),
  );
