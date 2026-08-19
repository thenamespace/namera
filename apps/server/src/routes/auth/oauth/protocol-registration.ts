import { Effect, FileSystem, Metric, Result } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServerResponse } from "effect/unstable/http";

import { Application } from "@namera-ai/application";
import { OAuthDynamicClientRegistrationRequest } from "@namera-ai/protocol/dto";
import { oauthClientRegistrationResults } from "@namera-ai/telemetry";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

import { hasMediaType, noStoreHeaders, oauthError, rateLimited } from "./protocol-shared.js";

export const OAuthRegistrationRoute = HttpRouter.add("POST", "/oauth/register", (request) =>
  Effect.gen(function* () {
    const identifier = yield* clientIdentifier;
    yield* Effect.logDebug("oauth.register.request.start", {
      remoteIp: identifier,
      contentType: request.headers["content-type"] ?? "",
    });
    const limited = yield* consumeRateLimit(
      "oauth.register.ip",
      identifier,
      rateLimitPolicy.oauth.registerByIp,
    ).pipe(Effect.result);
    if (Result.isFailure(limited)) return rateLimited(limited.failure);

    if (!hasMediaType(request, "application/json")) {
      yield* Effect.logWarning("oauth.register.request.invalid_media_type", {
        contentType: request.headers["content-type"] ?? "",
      });
      yield* Metric.update(
        Metric.withAttributes(oauthClientRegistrationResults, { result: "invalid_request" }),
        1,
      );
      return oauthError("invalid_client_metadata", "A JSON registration request is required");
    }

    const decoded = yield* HttpIncomingMessage.schemaBodyJson(
      OAuthDynamicClientRegistrationRequest,
    )(request).pipe(
      Effect.provideService(HttpIncomingMessage.MaxBodySize, FileSystem.KiB(32)),
      Effect.result,
    );
    if (Result.isFailure(decoded)) {
      yield* Effect.logWarning("oauth.register.request.decode_failed", {
        reason: "schema_decode_failed",
      });
      yield* Metric.update(
        Metric.withAttributes(oauthClientRegistrationResults, { result: "invalid_request" }),
        1,
      );
      return oauthError("invalid_client_metadata", "The client metadata is invalid");
    }

    yield* Effect.logDebug("oauth.register.request.payload", {
      redirectCount: decoded.success.redirect_uris.length,
      hasClientName: decoded.success.client_name !== undefined,
      tokenEndpointAuthMethod: decoded.success.token_endpoint_auth_method,
      grantTypes: decoded.success.grant_types,
      responseTypes: decoded.success.response_types,
      hasScope: decoded.success.scope !== undefined,
    });

    const registered = yield* (yield* Application).oauth.registration
      .register(decoded.success)
      .pipe(Effect.result);
    if (Result.isFailure(registered)) {
      const error = registered.failure;
      yield* Effect.logWarning("oauth.register.request.failed", { code: error.code });
      yield* Metric.update(
        Metric.withAttributes(oauthClientRegistrationResults, {
          result:
            error.code === "INVALID_REDIRECT_URI"
              ? "invalid_redirect_uri"
              : "invalid_client_metadata",
        }),
        1,
      );
      return oauthError(
        error.code === "INVALID_REDIRECT_URI" ? "invalid_redirect_uri" : "invalid_client_metadata",
        error.code === "INVALID_REDIRECT_URI"
          ? "One or more redirect URIs are invalid"
          : "The client metadata is invalid",
      );
    }

    yield* Effect.logDebug("oauth.register.request.success", {
      clientId: registered.success.client_id,
      redirectCount: registered.success.redirect_uris.length,
      grantCount: registered.success.grant_types.length,
    });
    return HttpServerResponse.jsonUnsafe(registered.success, {
      status: 201,
      headers: noStoreHeaders,
    });
  }),
);
