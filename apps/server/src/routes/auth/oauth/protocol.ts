import { Effect, FileSystem, Layer, Metric, Predicate, Result, Schema } from "effect";
import {
  HttpIncomingMessage,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { Application, AuthConfig } from "@namera-ai/application";
import type { OAuthTokenResult } from "@namera-ai/application";
import {
  OAuthDeviceAuthorizationStartRequest,
  OAuthDynamicClientRegistrationRequest,
} from "@namera-ai/protocol/dto";
import { oauthClientRegistrationResults } from "@namera-ai/telemetry";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

const noStoreHeaders = {
  "cache-control": "no-store",
  pragma: "no-cache",
} as const;

const first = (value: string | ReadonlyArray<string> | undefined) =>
  Array.isArray(value) ? value[0] : value;

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

const hasMediaType = (request: HttpServerRequest.HttpServerRequest, expected: string) =>
  request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() === expected;

const readUniqueFormParameters = (
  parameters: Iterable<readonly [string, string]>,
  supportedNames: ReadonlySet<string>,
) => {
  const form: Record<string, string> = {};
  const seen = new Set<string>();
  for (const [name, value] of parameters) {
    if (seen.has(name)) return undefined;
    seen.add(name);
    if (!supportedNames.has(name)) continue;
    form[name] = value;
  }
  return form;
};

const oauthError = (error: string, description: string, status = 400) =>
  HttpServerResponse.jsonUnsafe(
    { error, error_description: description },
    { status, headers: noStoreHeaders },
  );

const rateLimited = (failure: unknown) =>
  Predicate.isTagged(failure, "RateLimitExceeded")
    ? oauthError("temporarily_unavailable", "Too many requests", 429)
    : HttpServerResponse.empty({ status: 500 });

const tokenResponse = (result: OAuthTokenResult) =>
  HttpServerResponse.jsonUnsafe(
    {
      token_type: "Bearer",
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      ...(result.refreshToken === undefined ? {} : { refresh_token: result.refreshToken }),
      scope: result.scopes.join(" "),
    },
    { headers: noStoreHeaders },
  );

const register = HttpRouter.add("POST", "/oauth/register", (request) =>
  Effect.gen(function* () {
    const identifier = yield* clientIdentifier;
    const limited = yield* consumeRateLimit(
      "oauth.register.ip",
      identifier,
      rateLimitPolicy.oauth.registerByIp,
    ).pipe(Effect.result);
    if (Result.isFailure(limited)) return rateLimited(limited.failure);

    if (!hasMediaType(request, "application/json")) {
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
      yield* Metric.update(
        Metric.withAttributes(oauthClientRegistrationResults, { result: "invalid_request" }),
        1,
      );
      return oauthError("invalid_client_metadata", "The client metadata is invalid");
    }

    const registered = yield* (yield* Application).oauth.registration
      .register(decoded.success)
      .pipe(Effect.result);
    if (Result.isFailure(registered)) {
      const error = registered.failure;
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
    return HttpServerResponse.jsonUnsafe(registered.success, {
      status: 201,
      headers: noStoreHeaders,
    });
  }),
);

const authorize = HttpRouter.add("GET", "/oauth/authorize", () =>
  Effect.gen(function* () {
    const identifier = yield* clientIdentifier;
    const limited = yield* consumeRateLimit(
      "oauth.authorize.ip",
      identifier,
      rateLimitPolicy.oauth.authorizeByIp,
    ).pipe(Effect.result);
    if (Result.isFailure(limited)) return rateLimited(limited.failure);

    const params = yield* HttpServerRequest.ParsedSearchParams;
    if (Object.values(params).some((value) => Array.isArray(value))) {
      return oauthError("invalid_request", "OAuth parameters must not be repeated");
    }
    const app = yield* Application;
    const input = {
      clientId: first(params.client_id) ?? "",
      redirectUri: first(params.redirect_uri) ?? "",
      responseType: first(params.response_type) ?? "",
      codeChallenge: first(params.code_challenge) ?? "",
      codeChallengeMethod: first(params.code_challenge_method) ?? "",
      resource: first(params.resource) ?? "",
      scopes: (first(params.scope) ?? "").split(/\s+/).filter(Boolean),
      state: first(params.state) ?? null,
    };
    const result = yield* app.oauth.request.start(input).pipe(Effect.result);
    if (Result.isFailure(result)) {
      const code = result.failure.code;
      const error =
        code === "INVALID_CLIENT"
          ? "invalid_client"
          : code === "INVALID_SCOPE"
            ? "invalid_scope"
            : code === "INVALID_RESOURCE"
              ? "invalid_target"
              : code === "UNSUPPORTED_RESPONSE_TYPE"
                ? "unsupported_response_type"
                : "invalid_request";
      if (code === "INVALID_CLIENT" || code === "INVALID_REDIRECT_URI") {
        return oauthError(error, "The authorization request is invalid");
      }
      const redirectUrl = new URL(input.redirectUri);
      redirectUrl.searchParams.set("error", error);
      redirectUrl.searchParams.set("error_description", "The authorization request is invalid");
      if (input.state !== null) redirectUrl.searchParams.set("state", input.state);
      return HttpServerResponse.redirect(redirectUrl.toString(), { headers: noStoreHeaders });
    }
    return HttpServerResponse.redirect(result.success.consentUrl, {
      headers: noStoreHeaders,
    });
  }),
);

const deviceAuthorize = HttpRouter.add("POST", "/oauth/device/authorize", (request) =>
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
  }).pipe(Effect.catch(() => Effect.succeed(oauthError("invalid_request", "Malformed form body")))),
);

const token = HttpRouter.add("POST", "/oauth/token", (request) =>
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

const revoke = HttpRouter.add("POST", "/oauth/revoke", (request) =>
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

const authorizationServerMetadata = HttpRouter.add(
  "GET",
  "/.well-known/oauth-authorization-server",
  () =>
    Effect.gen(function* () {
      const config = yield* AuthConfig;
      const issuer = config.apiPublicOrigin.toString().replace(/\/$/, "");
      return HttpServerResponse.jsonUnsafe(
        {
          issuer,
          authorization_endpoint: `${issuer}/oauth/authorize`,
          device_authorization_endpoint: `${issuer}/oauth/device/authorize`,
          registration_endpoint: `${issuer}/oauth/register`,
          token_endpoint: `${issuer}/oauth/token`,
          revocation_endpoint: `${issuer}/oauth/revoke`,
          response_types_supported: ["code"],
          grant_types_supported: [
            "authorization_code",
            "refresh_token",
            "urn:ietf:params:oauth:grant-type:device_code",
          ],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
          scopes_supported: [
            "mcp:read",
            "mcp:execute",
            "wallet:read",
            "session-key:read",
            "execution:read",
            "execution:execute",
            "signature:create",
            "offline_access",
          ],
        },
        { headers: { "cache-control": "public, max-age=300" } },
      );
    }),
);

const protectedResourceMetadata = (path: `/${string}`) =>
  HttpRouter.add("GET", path, () =>
    Effect.gen(function* () {
      const config = yield* AuthConfig;
      const issuer = config.apiPublicOrigin.toString().replace(/\/$/, "");
      return HttpServerResponse.jsonUnsafe(
        {
          resource: `${issuer}/mcp`,
          authorization_servers: [issuer],
          bearer_methods_supported: ["header"],
          scopes_supported: ["mcp:read", "mcp:execute"],
        },
        { headers: { "cache-control": "public, max-age=300" } },
      );
    }),
  );

export const OAuthProtocolRoutes = Layer.mergeAll(
  register,
  authorize,
  deviceAuthorize,
  token,
  revoke,
  authorizationServerMetadata,
  protectedResourceMetadata("/.well-known/oauth-protected-resource/mcp"),
  protectedResourceMetadata("/.well-known/oauth-protected-resource"),
);
