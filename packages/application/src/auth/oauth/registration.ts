import { DateTime, Effect, Metric } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { OAuthClientRegistrationError } from "@namera-ai/protocol";
import type {
  OAuthDynamicClientRegistrationRequest,
  OAuthDynamicClientRegistrationResponse,
} from "@namera-ai/protocol/dto";
import type { OAuthGrantType, OAuthResponseType, OAuthScope } from "@namera-ai/protocol/model";
import {
  oauthClientRegistrationDuration,
  oauthClientRegistrationResults,
} from "@namera-ai/telemetry";

import { AuthConfig } from "#/auth/config";

const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

const isValidRedirectUri = (value: string) => {
  try {
    const url = new URL(value);
    if (url.hash !== "" || url.username !== "" || url.password !== "") return false;
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:") return isLoopbackHost(url.hostname);
    return false;
  } catch {
    return false;
  }
};

const isValidMetadataUri = (value: string) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || (url.protocol === "http:" && isLoopbackHost(url.hostname))) &&
      url.username === "" &&
      url.password === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
};

export const makeOAuthRegistrationApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;

  const register = Effect.fn("application.oauth.registration.register")(
    function* (input: OAuthDynamicClientRegistrationRequest) {
      yield* Effect.logDebug("oauth.registration.input", {
        redirectCount: input.redirect_uris.length,
        hasClientUri: input.client_uri !== undefined,
        hasLogoUri: input.logo_uri !== undefined,
        tokenEndpointAuthMethod: input.token_endpoint_auth_method,
        grantTypeCount: input.grant_types?.length ?? 0,
        responseTypeCount: input.response_types?.length ?? 0,
        hasScope: input.scope !== undefined,
      });

      const applicationType = input.application_type ?? "native";
      const redirectUris = [...new Set(input.redirect_uris)];
      if (
        redirectUris.length !== input.redirect_uris.length ||
        redirectUris.some((uri) => !isValidRedirectUri(uri))
      ) {
        yield* Effect.logWarning("oauth.registration.invalid_redirect_uri", {
          redirectUris,
          originalCount: input.redirect_uris.length,
          uniqueCount: redirectUris.length,
        });
        return yield* new OAuthClientRegistrationError({ code: "INVALID_REDIRECT_URI" });
      }
      if (
        (input.client_uri !== undefined && !isValidMetadataUri(input.client_uri)) ||
        (input.logo_uri !== undefined && !isValidMetadataUri(input.logo_uri))
      ) {
        yield* Effect.logWarning("oauth.registration.invalid_metadata_uri", {
          clientUri: input.client_uri,
          logoUri: input.logo_uri,
        });
        return yield* new OAuthClientRegistrationError({ code: "INVALID_CLIENT_METADATA" });
      }

      const grantTypes: ReadonlyArray<OAuthGrantType> = input.grant_types ?? ["authorization_code"];
      const responseTypes: ReadonlyArray<OAuthResponseType> = input.response_types ?? ["code"];
      yield* Effect.logDebug("oauth.registration.resolved_types", {
        grantTypes,
        responseTypes,
      });
      if (
        !grantTypes.includes("authorization_code") ||
        new Set(grantTypes).size !== grantTypes.length ||
        responseTypes.length !== 1 ||
        responseTypes[0] !== "code"
      ) {
        yield* Effect.logWarning("oauth.registration.type_validation_failed", {
          grantTypes,
          responseTypes,
        });
        return yield* new OAuthClientRegistrationError({ code: "INVALID_CLIENT_METADATA" });
      }

      const requestedScopes = input.scope?.split(/\s+/).filter(Boolean);
      const supportedScopes: ReadonlySet<string> = new Set<OAuthScope>([
        "mcp:read",
        "mcp:execute",
        "wallet:read",
        "session-key:read",
        "execution:read",
        "execution:execute",
        "signature:create",
        "offline_access",
      ]);
      if (
        requestedScopes !== undefined &&
        (requestedScopes.length === 0 ||
          new Set(requestedScopes).size !== requestedScopes.length ||
          requestedScopes.some((scope) => !supportedScopes.has(scope)))
      ) {
        yield* Effect.logWarning("oauth.registration.scope_validation_failed", {
          requestedScopes,
        });
        return yield* new OAuthClientRegistrationError({ code: "INVALID_CLIENT_METADATA" });
      }
      const scope = requestedScopes?.join(" ");
      const clientName = input.client_name?.trim() || "MCP client";
      const clientId = `${config.oauth.dynamicClientIdPrefix}${yield* crypto.randomToken(
        config.oauth.tokenBytes,
      )}`;
      const client = yield* repository.auth.oauth.client.insertDynamic({
        clientId,
        clientName,
        clientUri: input.client_uri ?? null,
        logoUri: input.logo_uri ?? null,
        redirectUris,
        grantTypes,
        responseTypes,
        tokenEndpointAuthMethod: "none",
        metadata: {
          applicationType,
          ...(scope === undefined ? {} : { scope }),
        },
        status: "active",
        metadataExpiresAt: null,
      });
      if (client === undefined) return yield* Effect.die("OAuth client ID collision");

      yield* Effect.logDebug("oauth.registration.client_created", {
        clientId: client.clientId,
        registrationType: client.registrationType,
        status: client.status,
        redirectCount: client.redirectUris.length,
      });

      yield* Metric.update(
        Metric.withAttributes(oauthClientRegistrationResults, { result: "success" }),
        1,
      );
      return {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(DateTime.toEpochMillis(client.createdAt) / 1_000),
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        client_name: client.clientName,
        ...(client.clientUri === null ? {} : { client_uri: client.clientUri }),
        ...(client.logoUri === null ? {} : { logo_uri: client.logoUri }),
        application_type: applicationType,
        ...(scope === undefined ? {} : { scope }),
      } satisfies OAuthDynamicClientRegistrationResponse;
    },
    Effect.trackDuration(oauthClientRegistrationDuration),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { register };
});
