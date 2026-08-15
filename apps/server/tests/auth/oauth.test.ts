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
      expect(yield* token.json).toMatchObject({ token_type: "Bearer" });
      expect(token.headers["cache-control"]).toBe("no-store");
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
      const rotated = yield* app.oauth.token.refresh({
        refreshToken: issuedRefreshToken,
        clientId,
      });
      expect(rotated.refreshToken).toBeTruthy();
      expect(rotated.refreshToken).not.toBe(issued.refreshToken);
      expect(
        yield* app.oauth.token
          .refresh({ refreshToken: issuedRefreshToken, clientId })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "OAuthTokenError", code: "INVALID_GRANT" });
    }),
  );
});
