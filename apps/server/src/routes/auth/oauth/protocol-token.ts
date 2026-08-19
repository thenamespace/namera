import { Effect, Result, Schema } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

import { Application } from "@namera-ai/application";
import { OAuthDeviceAuthorizationStartRequest } from "@namera-ai/protocol/dto";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

import {
  hasMediaType,
  noStoreHeaders,
  oauthError,
  rateLimited,
  readUniqueFormParameters,
  tokenResponse,
} from "./protocol-shared.js";

const tokenParameterNames = new Set([
  "grant_type",
  "code",
  "client_id",
  "redirect_uri",
  "code_verifier",
  "refresh_token",
  "resource",
  "scope",
  "client_secret",
  "device_code",
]);
const deviceParameterNames = new Set([
  "client_id",
  "scope",
  "resource",
  "device_name",
  "cli_version",
  "platform",
]);
const revokeParameterNames = new Set(["token", "token_type_hint"]);

export const OAuthDeviceAuthorizationRoute = HttpRouter.add(
  "POST",
  "/oauth/device/authorize",
  (request) =>
    Effect.gen(function* () {
      const identifier = yield* clientIdentifier;
      const limited = yield* consumeRateLimit(
        "oauth.device_authorize.ip",
        identifier,
        rateLimitPolicy.oauth.tokenByIp,
      ).pipe(Effect.result);
      if (Result.isFailure(limited)) return rateLimited(limited.failure);

      if (!hasMediaType(request, "application/x-www-form-urlencoded")) {
        return oauthError("invalid_request", "A form-encoded device request is required");
      }
      const form = readUniqueFormParameters(
        (yield* request.urlParamsBody).params,
        deviceParameterNames,
      );
      if (form === undefined) {
        return oauthError("invalid_request", "OAuth parameters must not be repeated");
      }
      const decoded = yield* Schema.decodeUnknownEffect(OAuthDeviceAuthorizationStartRequest)({
        client_id: form.client_id ?? "",
        scope: form.scope ?? "",
        resource: form.resource ?? "",
        device_name: form.device_name ?? "",
        cli_version: form.cli_version ?? "",
        platform: form.platform ?? "",
      }).pipe(Effect.result);
      if (Result.isFailure(decoded)) {
        return oauthError("invalid_request", "The device authorization request is invalid");
      }
      const input = decoded.success;
      const result = yield* (yield* Application).oauth.device
        .start({
          clientId: input.client_id,
          scopes: input.scope.split(/\s+/).filter(Boolean),
          resource: input.resource,
          deviceName: input.device_name,
          cliVersion: input.cli_version,
          platform: input.platform,
        })
        .pipe(Effect.result);
      if (Result.isFailure(result)) {
        return oauthError(result.failure.code.toLowerCase(), "The device request is invalid");
      }
      return HttpServerResponse.jsonUnsafe(
        {
          device_code: result.success.deviceCode,
          user_code: result.success.userCode,
          verification_uri: result.success.verificationUri,
          verification_uri_complete: result.success.verificationUriComplete,
          expires_in: result.success.expiresIn,
          interval: result.success.interval,
        },
        { headers: noStoreHeaders },
      );
    }).pipe(
      Effect.catch(() => Effect.succeed(oauthError("invalid_request", "Malformed form body"))),
    ),
);

export const OAuthTokenRoute = HttpRouter.add("POST", "/oauth/token", (request) =>
  Effect.gen(function* () {
    const identifier = yield* clientIdentifier;
    const limited = yield* consumeRateLimit(
      "oauth.token.ip",
      identifier,
      rateLimitPolicy.oauth.tokenByIp,
    ).pipe(Effect.result);
    if (Result.isFailure(limited)) return rateLimited(limited.failure);

    if (!hasMediaType(request, "application/x-www-form-urlencoded")) {
      return oauthError("invalid_request", "A form-encoded token request is required");
    }
    const form = readUniqueFormParameters(
      (yield* request.urlParamsBody).params,
      tokenParameterNames,
    );
    if (form === undefined) {
      return oauthError("invalid_request", "OAuth parameters must not be repeated");
    }
    const app = yield* Application;
    const grantType = form.grant_type;
    const result =
      grantType === "authorization_code"
        ? yield* app.oauth.token
            .exchangeAuthorizationCode({
              code: form.code ?? "",
              clientId: form.client_id ?? "",
              redirectUri: form.redirect_uri ?? "",
              codeVerifier: form.code_verifier ?? "",
              resource: form.resource ?? "",
            })
            .pipe(Effect.result)
        : grantType === "refresh_token"
          ? yield* app.oauth.token
              .refresh({
                refreshToken: form.refresh_token ?? "",
                clientId: form.client_id ?? "",
                resource: form.resource ?? "",
                ...(form.scope === undefined
                  ? {}
                  : { scopes: form.scope.split(/\s+/).filter(Boolean) }),
              })
              .pipe(Effect.result)
          : grantType === "urn:ietf:params:oauth:grant-type:device_code"
            ? yield* app.oauth.device
                .exchange({
                  deviceCode: form.device_code ?? "",
                  clientId: form.client_id ?? "",
                  resource: form.resource ?? "",
                })
                .pipe(Effect.result)
            : undefined;
    if (result === undefined) {
      return oauthError("unsupported_grant_type", "The grant type is not supported");
    }
    if (Result.isFailure(result)) {
      return oauthError(
        result.failure.code.toLowerCase(),
        "The token request could not be completed",
      );
    }
    return tokenResponse(result.success);
  }).pipe(Effect.catch(() => Effect.succeed(oauthError("invalid_request", "Malformed form body")))),
);

export const OAuthRevocationRoute = HttpRouter.add("POST", "/oauth/revoke", (request) =>
  Effect.gen(function* () {
    if (!hasMediaType(request, "application/x-www-form-urlencoded")) {
      return oauthError("invalid_request", "A form-encoded revocation request is required");
    }
    const form = readUniqueFormParameters(
      (yield* request.urlParamsBody).params,
      revokeParameterNames,
    );
    if (form === undefined) {
      return oauthError("invalid_request", "OAuth parameters must not be repeated");
    }
    if (form.token !== undefined) {
      yield* (yield* Application).oauth.token.revokeToken(form.token);
    }
    return HttpServerResponse.empty({ headers: noStoreHeaders });
  }).pipe(Effect.catch(() => Effect.succeed(oauthError("invalid_request", "Malformed form body")))),
);
