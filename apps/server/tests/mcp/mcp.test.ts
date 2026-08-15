import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";
import { HttpClientRequest } from "effect/unstable/http";

import { Application } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";

import {
  makeMcpProtocolClient,
  makeOAuthProtocolClient,
  makeTestApiClient,
  resetTestState,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

const clientId = "https://mcp-client.example/client.json";
const redirectUri = "https://mcp-client.example/callback";
const resource = "http://api.test/mcp";
const verifier = "a".repeat(64);

const mcpRequest = (
  body: unknown,
  options?: { readonly token?: string; readonly sessionId?: string },
) =>
  HttpClientRequest.post("http://api.test/mcp").pipe(
    HttpClientRequest.setHeaders({
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(options?.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
      ...(options?.sessionId === undefined ? {} : { "mcp-session-id": options.sessionId }),
      ...(options?.sessionId === undefined ? {} : { "mcp-protocol-version": "2025-06-18" }),
    }),
    HttpClientRequest.bodyText(JSON.stringify(body), "application/json"),
  );

const authorize = Effect.fnUntraced(function* () {
  const client = yield* makeTestApiClient;
  const owner = yield* signIn(client, testEmail("mcp-route@example.com"));
  const repository = yield* Repository;
  yield* repository.auth.oauth.client.insertPreRegistered({
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
  const wallet = yield* client.wallet.create({
    payload: {
      namespace: "eip155",
      implementation: "kernel",
      protectionLevel: "software",
      metadata: { version: 1, name: "MCP wallet" },
    },
  });
  const sessionKey = yield* client.sessionKey.create({
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
  const crypto = yield* CryptoService;
  const started = yield* (yield* Application).oauth.request.start({
    clientId,
    redirectUri,
    responseType: "code",
    codeChallenge: yield* crypto.sha256(verifier),
    codeChallengeMethod: "S256",
    resource,
    scopes: ["mcp:read", "offline_access"],
    state: null,
  });
  const approved = yield* client.oauth.approveOAuthAuthorizationRequest({
    payload: {
      requestId: started.request.id,
      organizationId: owner.actor.organization.id,
      sessionKeyIds: [sessionKey.id],
      expiresAt: null,
    },
  });
  const code = new URL(approved.redirectUrl).searchParams.get("code");
  if (code === null) return yield* Effect.die("Expected OAuth authorization code");
  const protocolClient = yield* makeOAuthProtocolClient();
  const response = yield* protocolClient.execute(
    HttpClientRequest.post("http://api.test/oauth/token").pipe(
      HttpClientRequest.bodyUrlParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        resource,
      }),
    ),
  );
  const token = yield* response.json;
  if (
    typeof token !== "object" ||
    token === null ||
    !("access_token" in token) ||
    typeof token.access_token !== "string"
  ) {
    return yield* Effect.die("Expected OAuth access token");
  }
  return { accessToken: token.access_token, sessionKey };
});

layer(TestServerLayer)("MCP route", (it) => {
  it.effect("challenges missing bearer credentials", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeMcpProtocolClient();
      const response = yield* client.execute(
        mcpRequest({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "Test client", version: "1.0.0" },
          },
        }),
      );
      expect(response.status).toBe(401);
      expect(response.headers["www-authenticate"]).toMatch(/^Bearer resource_metadata=/);
      expect(response.headers["www-authenticate"]).toContain(
        'resource_metadata="http://api.test/.well-known/oauth-protected-resource/mcp"',
      );
    }),
  );

  it.effect("lists only grants delegated to the current MCP authorization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const { accessToken, sessionKey } = yield* authorize();
      const client = yield* makeMcpProtocolClient();
      const initialized = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: { name: "Test client", version: "1.0.0" },
            },
          },
          { token: accessToken },
        ),
      );
      expect(initialized.status).toBe(200);
      const sessionId = initialized.headers["mcp-session-id"];
      if (sessionId === undefined) return yield* Effect.die("Expected MCP session ID");

      const tools = yield* client.execute(
        mcpRequest(
          { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* tools.json).toMatchObject({
        result: { tools: [{ name: "list_session_key_grants" }] },
      });

      const called = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "list_session_key_grants", arguments: {} },
          },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* called.json).toMatchObject({
        result: {
          structuredContent: {
            grants: [{ sessionKey: { id: sessionKey.id } }],
          },
        },
      });
    }),
  );
});
