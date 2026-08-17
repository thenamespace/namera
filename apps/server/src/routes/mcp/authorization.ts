import { DateTime, Effect, Metric, Predicate, Result } from "effect";
import { HttpMiddleware, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { AuthConfig } from "@namera-ai/application";
import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { mcpAuthenticationResults } from "@namera-ai/telemetry";

import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

import { CurrentMcpPrincipal } from "./principal.js";

const bearerToken = (authorization: string | undefined) => {
  if (authorization === undefined) return undefined;
  const [scheme, token, ...remaining] = authorization.trim().split(/\s+/);
  return scheme?.toLowerCase() === "bearer" && token !== undefined && remaining.length === 0
    ? token
    : undefined;
};

const bearerChallenge = (
  resourceMetadata: string,
  error?: "invalid_token" | "insufficient_scope",
) =>
  `Bearer ${[
    `resource_metadata="${resourceMetadata}"`,
    'scope="mcp:read"',
    ...(error === undefined ? [] : [`error="${error}"`]),
  ].join(", ")}`;

export const McpAuthorizationMiddleware = HttpMiddleware.make((httpEffect) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const pathname = request.url.split("?")[0] ?? request.url;
    if (pathname !== "/mcp") return yield* httpEffect;

    const config = yield* AuthConfig;
    const crypto = yield* CryptoService;
    const repository = yield* Repository;
    const issuer = config.apiPublicOrigin.toString().replace(/\/$/, "");
    const resource = `${issuer}/mcp`;
    const resourceMetadata = `${issuer}/.well-known/oauth-protected-resource/mcp`;
    const origin = request.headers.origin;
    if (
      origin !== undefined &&
      origin !== config.dashboardPublicOrigin.toString().replace(/\/$/, "")
    ) {
      yield* Metric.update(
        Metric.withAttributes(mcpAuthenticationResults, { result: "invalid_origin" }),
        1,
      );
      return HttpServerResponse.empty({
        status: 403,
        headers: { "cache-control": "no-store" },
      });
    }
    const unauthorized = (error?: "invalid_token") =>
      HttpServerResponse.empty({
        status: 401,
        headers: {
          "cache-control": "no-store",
          "www-authenticate": bearerChallenge(resourceMetadata, error),
        },
      });
    const token = bearerToken(request.headers.authorization);
    if (token === undefined) {
      yield* Metric.update(
        Metric.withAttributes(mcpAuthenticationResults, { result: "missing_token" }),
        1,
      );
      return unauthorized();
    }

    const now = yield* DateTime.now;
    const tokenHash = yield* crypto.hash({ purpose: cryptoPurpose.oauthAccessToken, value: token });
    const accessToken = yield* repository.auth.oauth.token
      .findActiveAccessByHash(tokenHash, now)
      .pipe(Effect.orDie);
    if (accessToken === undefined || accessToken.type !== "access") {
      yield* Metric.update(
        Metric.withAttributes(mcpAuthenticationResults, { result: "invalid_token" }),
        1,
      );
      return unauthorized("invalid_token");
    }

    // The token alone is insufficient: its authorization must still be active,
    // belong to the same client, and target this exact protected resource.
    const authorization = yield* repository.auth.oauth.authorization
      .findActiveById(accessToken.authorizationId, now)
      .pipe(Effect.orDie);
    if (
      authorization === undefined ||
      authorization.type !== "mcp" ||
      authorization.clientId !== accessToken.clientId ||
      authorization.resource !== resource ||
      accessToken.resource !== resource
    ) {
      yield* Metric.update(
        Metric.withAttributes(mcpAuthenticationResults, { result: "invalid_token" }),
        1,
      );
      return unauthorized("invalid_token");
    }

    if (!accessToken.scopes.includes("mcp:read")) {
      yield* Metric.update(
        Metric.withAttributes(mcpAuthenticationResults, { result: "insufficient_scope" }),
        1,
      );
      return HttpServerResponse.empty({
        status: 403,
        headers: {
          "cache-control": "no-store",
          "www-authenticate": bearerChallenge(resourceMetadata, "insufficient_scope"),
        },
      });
    }

    const limited = yield* consumeRateLimit(
      "mcp.authorization",
      authorization.id,
      rateLimitPolicy.mcp.byAuthorization,
    ).pipe(Effect.result);
    if (Result.isFailure(limited)) {
      return Predicate.isTagged(limited.failure, "RateLimitExceeded")
        ? HttpServerResponse.empty({
            status: 429,
            headers: {
              "cache-control": "no-store",
              "retry-after": String(limited.failure.retryAfterSeconds),
            },
          })
        : HttpServerResponse.empty({ status: 500 });
    }

    const grants = yield* repository.core.sessionKeyGrant
      .findActiveForActor(authorization.organizationId, authorization.actorId)
      .pipe(Effect.orDie);
    yield* Effect.all(
      [
        repository.auth.oauth.token.touchLastUsed(accessToken.id, now),
        repository.auth.oauth.authorization.touchLastUsed(authorization.id, now),
      ],
      { discard: true },
    ).pipe(Effect.orDie);
    yield* Metric.update(Metric.withAttributes(mcpAuthenticationResults, { result: "success" }), 1);

    return yield* Effect.provideService(httpEffect, CurrentMcpPrincipal, {
      authorizationId: authorization.id,
      tokenId: accessToken.id,
      organizationId: authorization.organizationId,
      actorId: authorization.actorId,
      clientId: authorization.clientId,
      scopes: accessToken.scopes,
      grants,
    }).pipe(
      Effect.map((response) => HttpServerResponse.setHeader(response, "cache-control", "no-store")),
    );
  }),
);
