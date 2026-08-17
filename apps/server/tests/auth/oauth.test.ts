import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect, Schema } from "effect";
import { HttpClientRequest } from "effect/unstable/http";

import { Application } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { OAuthAuthorizationRequestId } from "@namera-ai/protocol";
import { OAuthDynamicClientRegistrationResponse } from "@namera-ai/protocol/dto";

import {
  makeTestApiClient,
  makeOAuthProtocolClient,
  createMember,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

const clientId = "https://mcp-client.example/client.json";
const redirectUri = "https://mcp-client.example/callback";
const resource = "http://api.test/mcp";
const verifier = "a".repeat(64);

const createSessionKey = Effect.fnUntraced(function* () {
  const client = yield* makeTestApiClient;
  const wallet = yield* client.wallet.create({
    payload: {
      namespace: "eip155",
      implementation: "kernel",
      protectionLevel: "software",
      metadata: { version: 1, name: "MCP wallet" },
    },
  });
  return yield* client.sessionKey.create({
    payload: {
      namespace: "eip155",
      walletId: wallet.id,
      metadata: { version: 1, name: "MCP session" },
      policies: [
        {
          type: "evm.time-window",
          version: 1,
          startsAt: null,
          expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
        },
      ],
    },
  });
});

const registerClient = Effect.fnUntraced(function* () {
  const repository = yield* Repository;
  const client = yield* repository.auth.oauth.client.insertPreRegistered({
    clientId,
    clientName: "Namera MCP test client",
    clientUri: "https://mcp-client.example",
    logoUri: null,
    redirectUris: [redirectUri],
    grantTypes: ["authorization_code", "refresh_token"],
    responseTypes: ["code"],
    tokenEndpointAuthMethod: "none",
    metadata: {},
    status: "active",
    metadataExpiresAt: null,
  });
  if (client === undefined) return yield* Effect.die("Expected OAuth client registration");
  return client;
});

const startAuthorization = Effect.fnUntraced(function* (state = "test-state") {
  const crypto = yield* CryptoService;
  const app = yield* Application;
  return yield* app.oauth.request.start({
    clientId,
    redirectUri,
    responseType: "code",
    codeChallenge: yield* crypto.sha256(verifier),
    codeChallengeMethod: "S256",
    resource,
    scopes: ["mcp:read", "mcp:execute", "offline_access"],
    state,
  });
});

layer(TestServerLayer)("OAuth authorization routes", (it) => {
  it.effect("publishes discovery metadata and serves the full protocol exchange", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const protocolClient = yield* makeOAuthProtocolClient();
      const owner = yield* signIn(client, testEmail("oauth-protocol@example.com"));
      const sessionKey = yield* createSessionKey();
      const crypto = yield* CryptoService;
      const challenge = yield* crypto.sha256(verifier);

      const metadata = yield* protocolClient.get(
        "http://api.test/.well-known/oauth-authorization-server",
      );
      expect(metadata.status).toBe(200);
      expect(yield* metadata.json).toMatchObject({
        issuer: "http://api.test",
        authorization_endpoint: "http://api.test/oauth/authorize",
        registration_endpoint: "http://api.test/oauth/register",
        token_endpoint: "http://api.test/oauth/token",
      });
      const protectedResource = yield* protocolClient.get(
        "http://api.test/.well-known/oauth-protected-resource/mcp",
      );
      expect(yield* protectedResource.json).toMatchObject({
        resource,
        authorization_servers: ["http://api.test"],
      });

      const registrationResponse = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/register").pipe(
          HttpClientRequest.bodyJsonUnsafe({
            redirect_uris: [redirectUri],
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            client_name: "Codex CLI",
            application_type: "native",
          }),
        ),
      );
      expect(registrationResponse.status).toBe(201);
      expect(registrationResponse.headers["cache-control"]).toBe("no-store");
      const registration = yield* Schema.decodeUnknownEffect(
        OAuthDynamicClientRegistrationResponse,
      )(yield* registrationResponse.json);
      expect(registration).toMatchObject({
        client_name: "Codex CLI",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
      });
      expect(registration.client_id).toMatch(/^namera_mcp_/);
      expect(registration.client_id_issued_at).toBeGreaterThan(0);

      const authorizationResponse = yield* protocolClient.execute(
        HttpClientRequest.get("http://api.test/oauth/authorize").pipe(
          HttpClientRequest.setUrlParams({
            client_id: registration.client_id,
            redirect_uri: redirectUri,
            response_type: "code",
            code_challenge: challenge,
            code_challenge_method: "S256",
            resource,
            scope: "mcp:read mcp:execute offline_access",
            state: "protocol-state",
          }),
        ),
      );
      expect(authorizationResponse.status).toBe(302);
      const consentLocation = authorizationResponse.headers.location;
      if (consentLocation === undefined) return yield* Effect.die("Expected consent redirect");
      const requestId = new URL(consentLocation).searchParams.get("requestId");
      if (requestId === null) return yield* Effect.die("Expected OAuth request ID");
      const pending = yield* client.oauth.getOAuthAuthorizationRequest({
        params: { requestId: Schema.decodeSync(OAuthAuthorizationRequestId)(requestId) },
      });
      expect(pending.client.registrationType).toBe("dynamic");
      const approved = yield* client.oauth.approveOAuthAuthorizationRequest({
        payload: {
          requestId: pending.id,
          organizationId: owner.actor.organization.id,
          sessionKeyIds: [sessionKey.id],
          expiresAt: null,
        },
      });
      const code = new URL(approved.redirectUrl).searchParams.get("code");
      if (code === null) return yield* Effect.die("Expected OAuth code");
      const token = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/token").pipe(
          HttpClientRequest.bodyUrlParams({
            grant_type: "authorization_code",
            code,
            client_id: registration.client_id,
            redirect_uri: redirectUri,
            code_verifier: verifier,
            resource,
          }),
        ),
      );
      expect(token.status).toBe(200);
      const tokenBody = yield* token.json;
      expect(tokenBody).toMatchObject({ token_type: "Bearer" });
      expect(token.headers["cache-control"]).toBe("no-store");
      if (
        typeof tokenBody !== "object" ||
        tokenBody === null ||
        !("refresh_token" in tokenBody) ||
        typeof tokenBody.refresh_token !== "string"
      ) {
        return yield* Effect.die("Expected refresh token");
      }
      const missingResource = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/token").pipe(
          HttpClientRequest.bodyUrlParams({
            grant_type: "refresh_token",
            refresh_token: tokenBody.refresh_token,
            client_id: registration.client_id,
          }),
        ),
      );
      expect(missingResource.status).toBe(400);
      expect(yield* missingResource.json).toMatchObject({ error: "invalid_target" });
      const refreshed = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/token").pipe(
          HttpClientRequest.bodyUrlParams({
            grant_type: "refresh_token",
            refresh_token: tokenBody.refresh_token,
            client_id: registration.client_id,
            resource,
          }),
        ),
      );
      expect(refreshed.status).toBe(200);
      expect(yield* refreshed.json).toMatchObject({ token_type: "Bearer" });
    }),
  );

  it.effect("rejects unsafe dynamic client metadata", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const protocolClient = yield* makeOAuthProtocolClient();

      const response = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/register").pipe(
          HttpClientRequest.bodyJsonUnsafe({
            redirect_uris: ["http://attacker.example/callback"],
            token_endpoint_auth_method: "none",
            client_name: "Unsafe client",
          }),
        ),
      );
      expect(response.status).toBe(400);
      expect(yield* response.json).toMatchObject({ error: "invalid_redirect_uri" });

      const unsupported = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/register").pipe(
          HttpClientRequest.bodyJsonUnsafe({
            redirect_uris: [redirectUri],
            token_endpoint_auth_method: "client_secret_basic",
          }),
        ),
      );
      expect(unsupported.status).toBe(400);
      expect(yield* unsupported.json).toMatchObject({ error: "invalid_client_metadata" });

      const customScheme = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/register").pipe(
          HttpClientRequest.bodyJsonUnsafe({
            redirect_uris: ["namera-mcp:/callback"],
            token_endpoint_auth_method: "none",
            application_type: "native",
          }),
        ),
      );
      expect(customScheme.status).toBe(400);
      expect(yield* customScheme.json).toMatchObject({ error: "invalid_redirect_uri" });

      const loopback = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/register").pipe(
          HttpClientRequest.bodyJsonUnsafe({
            redirect_uris: ["http://127.0.0.1:49152/callback"],
            token_endpoint_auth_method: "none",
            application_type: "native",
          }),
        ),
      );
      expect(loopback.status).toBe(201);
    }),
  );

  it.effect("redirects authorization errors only after validating the client callback", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      yield* registerClient();
      const protocolClient = yield* makeOAuthProtocolClient();
      const crypto = yield* CryptoService;
      const challenge = yield* crypto.sha256(verifier);

      const invalidScope = yield* protocolClient.execute(
        HttpClientRequest.get("http://api.test/oauth/authorize").pipe(
          HttpClientRequest.setUrlParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            code_challenge: challenge,
            code_challenge_method: "S256",
            resource,
            scope: "mcp:unknown",
            state: "redirect-state",
          }),
        ),
      );
      expect(invalidScope.status).toBe(302);
      const callback = new URL(invalidScope.headers.location ?? "");
      expect(callback.origin + callback.pathname).toBe(redirectUri);
      expect(callback.searchParams.get("error")).toBe("invalid_scope");
      expect(callback.searchParams.get("state")).toBe("redirect-state");

      const invalidRedirect = yield* protocolClient.execute(
        HttpClientRequest.get("http://api.test/oauth/authorize").pipe(
          HttpClientRequest.setUrlParams({
            client_id: clientId,
            redirect_uri: "https://attacker.example/callback",
            response_type: "code",
            code_challenge: challenge,
            code_challenge_method: "S256",
            resource,
            scope: "mcp:read",
            state: "must-not-leak",
          }),
        ),
      );
      expect(invalidRedirect.status).toBe(400);
      expect(invalidRedirect.headers.location).toBeUndefined();
      expect(yield* invalidRedirect.json).toMatchObject({ error: "invalid_request" });
    }),
  );

  it.effect("rejects malformed PKCE challenges and repeated authorization parameters", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      yield* registerClient();
      const protocolClient = yield* makeOAuthProtocolClient();

      const invalidChallenge = yield* protocolClient.execute(
        HttpClientRequest.get("http://api.test/oauth/authorize").pipe(
          HttpClientRequest.setUrlParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            code_challenge: "*".repeat(43),
            code_challenge_method: "S256",
            resource,
            scope: "mcp:read",
            state: "pkce-state",
          }),
        ),
      );
      expect(invalidChallenge.status).toBe(302);
      expect(new URL(invalidChallenge.headers.location ?? "").searchParams.get("error")).toBe(
        "invalid_request",
      );

      const duplicate = yield* protocolClient.get(
        `http://api.test/oauth/authorize?client_id=${encodeURIComponent(clientId)}&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`,
      );
      expect(duplicate.status).toBe(400);
      expect(duplicate.headers.location).toBeUndefined();
      expect(yield* duplicate.json).toMatchObject({ error: "invalid_request" });
    }),
  );

  it.effect("requires form media types and unique token and revocation parameters", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const protocolClient = yield* makeOAuthProtocolClient();

      const tokenJson = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/token").pipe(
          HttpClientRequest.bodyJsonUnsafe({ grant_type: "authorization_code" }),
        ),
      );
      expect(tokenJson.status).toBe(400);
      expect(yield* tokenJson.json).toMatchObject({ error: "invalid_request" });

      const duplicateToken = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/token").pipe(
          HttpClientRequest.bodyText(
            "grant_type=authorization_code&grant_type=refresh_token",
            "application/x-www-form-urlencoded",
          ),
        ),
      );
      expect(duplicateToken.status).toBe(400);
      expect(yield* duplicateToken.json).toMatchObject({ error: "invalid_request" });

      const revokeJson = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/revoke").pipe(
          HttpClientRequest.bodyJsonUnsafe({ token: "not-a-token" }),
        ),
      );
      expect(revokeJson.status).toBe(400);
      expect(yield* revokeJson.json).toMatchObject({ error: "invalid_request" });

      const duplicateRevoke = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/revoke").pipe(
          HttpClientRequest.bodyText(
            "token=first&token=second",
            "application/x-www-form-urlencoded",
          ),
        ),
      );
      expect(duplicateRevoke.status).toBe(400);
      expect(yield* duplicateRevoke.json).toMatchObject({ error: "invalid_request" });
    }),
  );

  it.effect("approves, reads, audits, notifies, and revokes an MCP authorization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("oauth-owner@example.com"));
      yield* registerClient();
      const sessionKey = yield* createSessionKey();
      const started = yield* startAuthorization();

      expect(
        (yield* client.oauth.getOAuthAuthorizationRequest({
          params: { requestId: started.request.id },
        })).client.clientName,
      ).toBe("Namera MCP test client");

      const approved = yield* client.oauth.approveOAuthAuthorizationRequest({
        payload: {
          requestId: started.request.id,
          organizationId: owner.actor.organization.id,
          sessionKeyIds: [sessionKey.id],
          expiresAt: null,
        },
      });
      const callback = new URL(approved.redirectUrl);
      expect(callback.origin + callback.pathname).toBe(redirectUri);
      expect(callback.searchParams.get("code")).toBeTruthy();
      expect(callback.searchParams.get("state")).toBe("test-state");

      const authorizations = yield* client.oauth.listMcpAuthorizations();
      expect(authorizations).toHaveLength(1);
      expect(authorizations[0]).toMatchObject({
        client: { clientId },
        status: "active",
        sessionKeys: [{ id: sessionKey.id }],
      });
      const authorization = authorizations[0];
      if (authorization === undefined) return yield* Effect.die("Expected authorization");
      expect(
        (yield* client.oauth.getMcpAuthorization({
          params: { authorizationId: authorization.id },
        })).id,
      ).toBe(authorization.id);

      const repository = yield* Repository;
      expect(
        (yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        )).some(
          (event) =>
            event.event === "mcp_authorization.approved" && event.resourceId === authorization.id,
        ),
      ).toBe(true);
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          ({ notification }) =>
            notification.type === "mcp_authorization.approved" &&
            notification.resourceId === authorization.id,
        ),
      ).toBe(true);
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:mcp_authorization.approved:${authorization.id}:${owner.actor.user.id}:email`,
        ),
      ).toBeUndefined();

      const revoked = yield* client.oauth.revokeMcpAuthorization({
        payload: { authorizationId: authorization.id },
      });
      expect(revoked.status).toBe("revoked");
      expect(revoked.sessionKeys).toEqual([]);
      expect(
        (yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        )).some(
          (event) =>
            event.event === "mcp_authorization.revoked" && event.resourceId === authorization.id,
        ),
      ).toBe(true);
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          ({ notification }) => notification.type === "mcp_authorization.revoked",
        ),
      ).toBe(true);
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:mcp_authorization.revoked:${authorization.id}:${owner.actor.user.id}:email`,
        ),
      ).toBeUndefined();
    }),
  );

  it.effect("denies a pending request without creating an authorization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("oauth-deny@example.com"));
      yield* registerClient();
      const started = yield* startAuthorization("deny-state");
      const denied = yield* client.oauth.denyOAuthAuthorizationRequest({
        payload: { requestId: started.request.id },
      });
      const callback = new URL(denied.redirectUrl);
      expect(callback.searchParams.get("error")).toBe("access_denied");
      expect(callback.searchParams.get("state")).toBe("deny-state");
      expect(yield* client.oauth.listMcpAuthorizations()).toEqual([]);
    }),
  );

  it.effect("allows members to read but not approve or revoke authorizations", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("oauth-permission-owner@example.com"));
      yield* registerClient();
      const sessionKey = yield* createSessionKey();
      const member = yield* createMember(client, testEmail("oauth-permission-member@example.com"));
      yield* setAuthToken(member.ownerToken);
      const started = yield* startAuthorization();
      const approved = yield* client.oauth.approveOAuthAuthorizationRequest({
        payload: {
          requestId: started.request.id,
          organizationId: owner.actor.organization.id,
          sessionKeyIds: [sessionKey.id],
          expiresAt: null,
        },
      });
      expect(approved.redirectUrl).toContain(redirectUri);
      const [authorization] = yield* client.oauth.listMcpAuthorizations();
      if (authorization === undefined) return yield* Effect.die("Expected authorization");

      yield* setAuthToken(member.memberToken);
      expect(yield* client.oauth.listMcpAuthorizations()).toHaveLength(1);
      expect(
        yield* client.oauth
          .revokeMcpAuthorization({ payload: { authorizationId: authorization.id } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });

      const next = yield* startAuthorization("member-approval");
      expect(
        yield* client.oauth
          .approveOAuthAuthorizationRequest({
            payload: {
              requestId: next.request.id,
              organizationId: owner.actor.organization.id,
              sessionKeyIds: [sessionKey.id],
              expiresAt: null,
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
    }),
  );

  it.effect("exchanges a one-time PKCE code and rotates refresh tokens", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("oauth-token@example.com"));
      yield* registerClient();
      const sessionKey = yield* createSessionKey();
      const started = yield* startAuthorization();
      const approved = yield* client.oauth.approveOAuthAuthorizationRequest({
        payload: {
          requestId: started.request.id,
          organizationId: owner.actor.organization.id,
          sessionKeyIds: [sessionKey.id],
          expiresAt: null,
        },
      });
      const code = new URL(approved.redirectUrl).searchParams.get("code");
      if (code === null) return yield* Effect.die("Expected authorization code");
      const app = yield* Application;
      expect(
        yield* app.oauth.token
          .exchangeAuthorizationCode({
            code,
            clientId,
            redirectUri,
            codeVerifier: "a".repeat(42),
            resource,
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "OAuthTokenError", code: "INVALID_REQUEST" });
      const issued = yield* app.oauth.token.exchangeAuthorizationCode({
        code,
        clientId,
        redirectUri,
        codeVerifier: verifier,
        resource,
      });
      expect(issued.accessToken).toBeTruthy();
      expect(issued.refreshToken).toBeTruthy();
      expect(
        yield* app.oauth.token
          .exchangeAuthorizationCode({
            code,
            clientId,
            redirectUri,
            codeVerifier: verifier,
            resource,
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "OAuthTokenError", code: "INVALID_GRANT" });
      const issuedRefreshToken = issued.refreshToken;
      if (issuedRefreshToken === undefined) return yield* Effect.die("Expected refresh token");
      expect(
        yield* app.oauth.token
          .refresh({
            refreshToken: issuedRefreshToken,
            clientId,
            resource: "http://api.test/another-resource",
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "OAuthTokenError", code: "INVALID_TARGET" });
      const rotated = yield* app.oauth.token.refresh({
        refreshToken: issuedRefreshToken,
        clientId,
        resource,
      });
      expect(rotated.refreshToken).toBeTruthy();
      expect(rotated.refreshToken).not.toBe(issued.refreshToken);
      expect(
        yield* app.oauth.token
          .refresh({ refreshToken: issuedRefreshToken, clientId, resource })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "OAuthTokenError", code: "INVALID_GRANT" });
    }),
  );

  it.effect("authorizes a CLI through the device flow and issues delegated tokens", () =>
    Effect.gen(function* () {
      yield* resetTestState();

      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("oauth-cli@example.com"));
      const sessionKey = yield* createSessionKey();
      const protocolClient = yield* makeOAuthProtocolClient();
      const started = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/device/authorize").pipe(
          HttpClientRequest.bodyUrlParams({
            client_id: "namera-cli",
            scope:
              "wallet:read session-key:read execution:read execution:execute signature:create offline_access",
            resource: "http://api.test",
            device_name: "Developer Mac",
            cli_version: "0.1.0",
            platform: "darwin-arm64",
          }),
        ),
      );
      expect(started.status).toBe(200);

      const startedBody = yield* started.json;
      if (
        typeof startedBody !== "object" ||
        startedBody === null ||
        !("device_code" in startedBody) ||
        !("user_code" in startedBody) ||
        typeof startedBody.device_code !== "string" ||
        typeof startedBody.user_code !== "string"
      ) {
        return yield* Effect.die("Expected a device authorization response");
      }

      const pending = yield* client.oauth.getOAuthDeviceAuthorization({
        query: { userCode: startedBody.user_code },
      });
      expect(pending).toMatchObject({
        userCode: startedBody.user_code,
        deviceName: "Developer Mac",
        cliVersion: "0.1.0",
        platform: "darwin-arm64",
      });

      expect(
        yield* client.oauth.approveOAuthDeviceAuthorization({
          payload: {
            deviceAuthorizationId: pending.id,
            organizationId: owner.actor.organization.id,
            sessionKeyIds: [sessionKey.id],
          },
        }),
      ).toEqual({ status: "approved" });

      const issued = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/token").pipe(
          HttpClientRequest.bodyUrlParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: startedBody.device_code,
            client_id: "namera-cli",
            resource: "http://api.test",
          }),
        ),
      );
      expect(issued.status).toBe(200);
      expect(yield* issued.json).toMatchObject({
        token_type: "Bearer",
        scope:
          "wallet:read session-key:read execution:read execution:execute signature:create offline_access",
      });

      expect(yield* client.oauth.listCliAuthorizations()).toMatchObject([
        {
          type: "cli",
          metadata: { type: "cli", deviceName: "Developer Mac" },
          sessionKeys: [{ id: sessionKey.id }],
        },
      ]);
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          ({ notification }) => notification.type === "cli_authorization.approved",
        ),
      ).toBe(true);

      const secondExchange = yield* protocolClient.execute(
        HttpClientRequest.post("http://api.test/oauth/token").pipe(
          HttpClientRequest.bodyUrlParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: startedBody.device_code,
            client_id: "namera-cli",
            resource: "http://api.test",
          }),
        ),
      );
      expect(secondExchange.status).toBe(400);
      expect(yield* secondExchange.json).toMatchObject({ error: "invalid_grant" });
    }),
  );
});
