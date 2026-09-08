import { DateTime, Effect, Metric, Schema } from "effect";

import { Repository } from "@namera-ai/database";
import {
  OAuthAuthorizationRequestError,
  type OAuthAuthorizationRequestId,
} from "@namera-ai/protocol";
import { OAuthPkceCodeChallenge, type OAuthScope } from "@namera-ai/protocol/model";
import { oauthAuthorizationRequestResults } from "@namera-ai/telemetry";

import { AuthConfig } from "#/auth/config";

export interface StartOAuthAuthorizationInput {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly responseType: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: string;
  readonly resource: string;
  readonly scopes: ReadonlyArray<string>;
  readonly state: string | null;
}

export const makeOAuthRequestApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const repository = yield* Repository;

  const start = Effect.fn("application.oauth.request.start")(
    function* (input: StartOAuthAuthorizationInput) {
      const client = yield* repository.auth.oauth.client.findByClientId(input.clientId);
      if (client === undefined || client.status !== "active") {
        yield* Metric.update(
          Metric.withAttributes(oauthAuthorizationRequestResults, { result: "invalid_client" }),
          1,
        );
        return yield* new OAuthAuthorizationRequestError({ code: "INVALID_CLIENT" });
      }
      if (!client.redirectUris.includes(input.redirectUri)) {
        return yield* new OAuthAuthorizationRequestError({ code: "INVALID_REDIRECT_URI" });
      }
      if (input.responseType !== "code" || !client.responseTypes.includes("code")) {
        return yield* new OAuthAuthorizationRequestError({ code: "UNSUPPORTED_RESPONSE_TYPE" });
      }
      if (
        input.codeChallengeMethod !== "S256" ||
        !Schema.is(OAuthPkceCodeChallenge)(input.codeChallenge)
      ) {
        return yield* new OAuthAuthorizationRequestError({ code: "INVALID_REQUEST" });
      }

      const apiResource = new URL(config.apiPublicOrigin).origin;
      const legacyMcpResource = new URL("/mcp", config.apiPublicOrigin).toString();
      if (input.resource !== apiResource && input.resource !== legacyMcpResource) {
        return yield* new OAuthAuthorizationRequestError({ code: "INVALID_RESOURCE" });
      }

      const scopes = [...new Set(input.scopes)];
      const supportedScopes = new Set<OAuthScope>([
        "mcp:read",
        "mcp:execute",
        "wallet:read",
        "session-key:read",
        "execution:read",
        "execution:execute",
        "signature:create",
        "offline_access",
      ]);
      const registeredScopeValue =
        typeof client.metadata === "object" && client.metadata !== null
          ? Reflect.get(client.metadata, "scope")
          : undefined;
      const registeredScope =
        typeof registeredScopeValue === "string"
          ? new Set(registeredScopeValue.split(/\s+/).filter(Boolean))
          : undefined;
      if (
        scopes.length === 0 ||
        scopes.some((scope) => !supportedScopes.has(scope as OAuthScope)) ||
        (registeredScope !== undefined && scopes.some((scope) => !registeredScope.has(scope))) ||
        (scopes.includes("offline_access") && !client.grantTypes.includes("refresh_token"))
      ) {
        return yield* new OAuthAuthorizationRequestError({ code: "INVALID_SCOPE" });
      }

      const now = yield* DateTime.now;
      const request = yield* repository.auth.oauth.authorizationRequest.insert({
        clientId: client.id,
        redirectUri: input.redirectUri,
        responseType: "code",
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: "S256",
        resource: input.resource,
        requestedScopes: scopes as ReadonlyArray<OAuthScope>,
        state: input.state,
        status: "pending",
        expiresAt: DateTime.addDuration(now, config.oauth.authorizationRequestTimeToLive),
      });

      const consentUrl = new URL("/oauth/authorize", config.dashboardPublicOrigin);
      consentUrl.searchParams.set("requestId", request.id);
      yield* Metric.update(
        Metric.withAttributes(oauthAuthorizationRequestResults, { result: "success" }),
        1,
      );
      return { request, client, consentUrl: consentUrl.toString() };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const get = Effect.fn("application.oauth.request.get")(
    function* (requestId: OAuthAuthorizationRequestId) {
      const request = yield* repository.auth.oauth.authorizationRequest.findPendingById(
        requestId,
        yield* DateTime.now,
      );
      if (request === undefined) {
        return yield* new OAuthAuthorizationRequestError({ code: "REQUEST_NOT_FOUND" });
      }
      const client = yield* repository.auth.oauth.client.findById(request.clientId);
      if (client === undefined || client.status !== "active") {
        return yield* new OAuthAuthorizationRequestError({ code: "INVALID_CLIENT" });
      }
      return { request, client };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { start, get };
});
