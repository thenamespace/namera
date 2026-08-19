import { Effect, Result } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { Application } from "@namera-ai/application";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

import { firstParameter, noStoreHeaders, oauthError, rateLimited } from "./protocol-shared.js";

export const OAuthAuthorizationRoute = HttpRouter.add("GET", "/oauth/authorize", () =>
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
    const input = {
      clientId: firstParameter(params.client_id) ?? "",
      redirectUri: firstParameter(params.redirect_uri) ?? "",
      responseType: firstParameter(params.response_type) ?? "",
      codeChallenge: firstParameter(params.code_challenge) ?? "",
      codeChallengeMethod: firstParameter(params.code_challenge_method) ?? "",
      resource: firstParameter(params.resource) ?? "",
      scopes: (firstParameter(params.scope) ?? "").split(/\s+/).filter(Boolean),
      state: firstParameter(params.state) ?? null,
    };
    const result = yield* (yield* Application).oauth.request.start(input).pipe(Effect.result);
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
    return HttpServerResponse.redirect(result.success.consentUrl, { headers: noStoreHeaders });
  }),
);
