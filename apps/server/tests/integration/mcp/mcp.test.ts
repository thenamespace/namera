import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect, Predicate } from "effect";
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
} from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

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

const authorize = Effect.fnUntraced(function* (options?: { readonly execute?: boolean }) {
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
      owner: { type: "namera-managed", protectionLevel: "software" },
      metadata: { version: 1, name: "MCP wallet" },
    },
  });
  const expiresAt = DateTime.addDuration(yield* DateTime.now, Duration.days(1));
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
          expiresAt,
        },
        ...(options?.execute === true
          ? [
              {
                type: "evm.native-spend-limit" as const,
                version: 1 as const,
                limits: [
                  {
                    chainId: "eip155:1" as const,
                    period: "lifetime" as const,
                    maxAmount: 10n,
                  },
                ],
              },
              {
                type: "evm.signature" as const,
                version: 1 as const,
                allowedTypes: ["message" as const],
              },
            ]
          : []),
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
    scopes: [
      "mcp:read",
      ...(options?.execute === true ? (["mcp:execute"] as const) : []),
      "offline_access",
    ],
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
  return { accessToken: token.access_token, sessionKey, wallet };
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
      const toolsJson = yield* tools.json;
      expect(toolsJson).toMatchObject({
        result: {
          tools: [
            { name: "list_wallets" },
            { name: "get_wallet" },
            { name: "list_session_keys" },
            { name: "get_session_key" },
            { name: "execute_transaction" },
            { name: "simulate_transaction" },
            { name: "get_transaction_status" },
            { name: "get_executions" },
            { name: "sign" },
            { name: "verify_signature" },
          ],
        },
      });
      if (
        !Predicate.isObject(toolsJson) ||
        !Predicate.isObject(toolsJson.result) ||
        !Array.isArray(toolsJson.result.tools)
      ) {
        return yield* Effect.die("Expected an MCP tool list");
      }
      for (const tool of toolsJson.result.tools) {
        if (!Predicate.isObject(tool)) return yield* Effect.die("Expected an MCP tool");
        expect(tool.inputSchema).toMatchObject({ type: "object" });
        expect(tool.outputSchema).toMatchObject({ type: "object" });
      }

      const called = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "list_session_keys", arguments: {} },
          },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* called.json).toMatchObject({
        result: {
          structuredContent: {
            sessionKeys: [{ id: sessionKey.id }],
          },
        },
      });

      const wallets = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: { name: "list_wallets", arguments: {} },
          },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* wallets.json).toMatchObject({
        result: { structuredContent: { wallets: [{ id: sessionKey.walletId }] } },
      });

      const walletSessionKeys = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 5,
            method: "tools/call",
            params: {
              name: "list_session_keys",
              arguments: { walletId: sessionKey.walletId },
            },
          },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* walletSessionKeys.json).toMatchObject({
        result: { structuredContent: { sessionKeys: [{ id: sessionKey.id }] } },
      });

      const deniedExecution = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 6,
            method: "tools/call",
            params: { name: "execute_transaction", arguments: {} },
          },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* deniedExecution.json).toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            error: { code: "INSUFFICIENT_SCOPE", retryable: false },
          },
        },
      });
    }),
  );

  it.effect("simulates, executes, reads status, signs, and verifies with delegated authority", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const { accessToken, wallet } = yield* authorize({ execute: true });
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
      const sessionId = initialized.headers["mcp-session-id"];
      if (sessionId === undefined) return yield* Effect.die("Expected MCP session ID");

      const simulated = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "simulate_transaction",
              arguments: {
                namespace: "eip155",
                walletId: wallet.id,
                chainId: "eip155:1",
                calls: [{ to: wallet.address, value: "1", data: "0x" }],
              },
            },
          },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* simulated.json).toMatchObject({
        result: {
          structuredContent: {
            simulation: { allowed: true, callsSucceeded: true, walletId: wallet.id },
          },
        },
      });

      const executed = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "execute_transaction",
              arguments: {
                namespace: "eip155",
                walletId: wallet.id,
                chainId: "eip155:1",
                calls: [{ to: wallet.address, value: "1", data: "0x" }],
                sponsor: false,
              },
            },
          },
          { token: accessToken, sessionId },
        ),
      );
      const executedJson = yield* executed.json;
      if (
        !Predicate.isObject(executedJson) ||
        !Predicate.isObject(executedJson.result) ||
        !Predicate.isObject(executedJson.result.structuredContent)
      ) {
        return yield* Effect.die("Expected a structured execution result");
      }
      expect(executedJson.result.structuredContent).toMatchObject({
        execution: {
          namespace: "eip155",
          status: "confirmed",
        },
      });
      const executionResult = executedJson.result.structuredContent.execution;
      if (!Predicate.isObject(executionResult)) {
        return yield* Effect.die("Expected a structured execution value");
      }
      const submissionId = executionResult.submissionId;
      const executionId = executionResult.executionId;
      if (typeof submissionId !== "string" || typeof executionId !== "string") {
        return yield* Effect.die("Expected execution identifiers");
      }

      const submission = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
              name: "get_transaction_status",
              arguments: { submissionId },
            },
          },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* submission.json).toMatchObject({
        result: {
          structuredContent: {
            submission: { status: "confirmed", execution: { id: executionId } },
          },
        },
      });

      const executions = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: { name: "get_executions", arguments: {} },
          },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* executions.json).toMatchObject({
        result: { structuredContent: { items: [{ details: { id: executionId } }] } },
      });

      const signed = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 5,
            method: "tools/call",
            params: {
              name: "sign",
              arguments: {
                request: {
                  namespace: "eip155",
                  type: "message",
                  walletId: wallet.id,
                  chainId: "eip155:1",
                  message: "Sign with Namera MCP",
                },
              },
            },
          },
          { token: accessToken, sessionId },
        ),
      );
      const signedJson = yield* signed.json;
      expect(signedJson).toMatchObject({
        result: {
          structuredContent: {
            signature: {
              namespace: "eip155",
              type: "message",
              walletId: wallet.id,
            },
          },
        },
      });
      if (
        !Predicate.isObject(signedJson) ||
        !Predicate.isObject(signedJson.result) ||
        !Predicate.isObject(signedJson.result.structuredContent) ||
        !Predicate.isObject(signedJson.result.structuredContent.signature) ||
        typeof signedJson.result.structuredContent.signature.signature !== "string"
      ) {
        return yield* Effect.die("Expected a structured signature result");
      }

      const verified = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 6,
            method: "tools/call",
            params: {
              name: "verify_signature",
              arguments: {
                request: {
                  namespace: "eip155",
                  type: "message",
                  walletId: wallet.id,
                  chainId: "eip155:1",
                  message: "Sign with Namera MCP",
                  signature: signedJson.result.structuredContent.signature.signature,
                },
              },
            },
          },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* verified.json).toMatchObject({
        result: {
          structuredContent: {
            verification: { valid: true, walletId: wallet.id },
          },
        },
      });

      const invalid = yield* client.execute(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 7,
            method: "tools/call",
            params: { name: "execute_transaction", arguments: {} },
          },
          { token: accessToken, sessionId },
        ),
      );
      expect(yield* invalid.json).toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            error: { code: "INVALID_ARGUMENT", retryable: false },
          },
        },
      });
    }),
  );
});
