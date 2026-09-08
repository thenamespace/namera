import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NodeCrypto } from "@effect/platform-node";
import { Effect, Layer, Redacted, Schema } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { PrepareSignatureRequest, PrepareSignatureResponse } from "@namera-ai/protocol/dto";
import { LocalEvmSessionBinding, LocalSessionKeyMaterial } from "@namera-ai/protocol/local";
import { sealLocalSessionKey, type NameraFetch, type ResolveSessionSigner } from "@namera-ai/sdk";
import { verifyTypedData, type TypedDataDefinition } from "viem";
import { generatePrivateKey } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";

import { LocalMcpApi } from "../../../src/services/mcp/api-client.js";
import { LocalMcpOAuth } from "../../../src/services/mcp/oauth-broker.js";
import { localMcpRoutes } from "../../../src/services/mcp/routes.js";
import { makeSessionSignerResolver } from "../../../src/services/session-keystore/resolver.js";
import { createSessionKeystore } from "../../../src/services/session-keystore/storage.js";
import { authorizeMcpHttp } from "../../fixtures/mcp-http.js";
import { apiOrigin, makeMcpOAuthFixture, urls } from "../../fixtures/mcp-oauth.js";
import { mcpSignatureFixture } from "../../fixtures/mcp-signature.js";

const id = "01a00407-5961-75cf-933e-9cfd0336ec16";
const otherId = "01a00407-5961-75cf-933e-9cfd0336ec17";

const withTools = async (
  test: (context: {
    rpc: (
      method: string,
      params?: unknown,
      sessionId?: string,
      token?: string,
    ) => Promise<Response>;
    setAuthorization: (id: string) => void;
    revoke: () => void;
    readOnly: () => void;
    setGrants: (grants: readonly unknown[]) => void;
    fetch: ReturnType<typeof vi.fn<NameraFetch>>;
    signer: ReturnType<typeof vi.fn<ResolveSessionSigner>>;
  }) => Promise<void>,
  options?: {
    readonly grants?: readonly unknown[];
    readonly resolveSigner?: ResolveSessionSigner;
    readonly fetch?: NameraFetch;
  },
) => {
  let authorizationId = id;
  let revoked = false;
  let scopes = ["mcp:read", "mcp:execute"];
  let grants = options?.grants ?? [];
  const fetch = vi.fn<NameraFetch>(async (input, init) => {
    const path = new URL(input.toString()).pathname;
    if (path.endsWith("/actor") && revoked) return new Response(null, { status: 401 });
    if (path.endsWith("/actor"))
      return Response.json({
        type: "mcp",
        data: {
          actorId: id,
          organizationId: id,
          grants,
          authorization: {
            id: authorizationId,
            clientId: id,
            scopes,
            metadata: { type: "mcp", version: 1 },
            expiresAt: null,
            lastUsedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
      });
    if (path === "/wallets") return Response.json([]);
    if (options?.fetch) return options.fetch(input, init);
    throw new Error(`Unexpected API request: ${path}`);
  });
  const signer = vi.fn<ResolveSessionSigner>(
    options?.resolveSigner ??
      (async () => {
        throw new Error("must not open keystore");
      }),
  );
  const fixture = await Effect.runPromise(
    makeMcpOAuthFixture().pipe(Effect.provide(NodeCrypto.layer)),
  );
  let accessToken = "";
  const routes = localMcpRoutes(urls).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(LocalMcpOAuth, fixture.broker),
        LocalMcpApi.layer({ apiOrigin, fetch, resolveSessionSigner: signer }),
      ),
    ),
  );
  const server = HttpRouter.toWebHandler(routes, { disableLogger: true });
  let requestId = 0;
  const rpc = (method: string, params: unknown = {}, sessionId?: string, token = accessToken) =>
    server.handler(
      new Request(urls.resource, {
        method: "POST",
        headers: {
          host: urls.authority,
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(sessionId === undefined
            ? {}
            : { "mcp-session-id": sessionId, "mcp-protocol-version": "2025-06-18" }),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
      }),
    );
  try {
    accessToken = (await authorizeMcpHttp(server.handler, fixture.authorization)).access_token;
    await test({
      rpc,
      fetch,
      signer,
      setAuthorization: (value) => {
        authorizationId = value;
      },
      revoke: () => {
        revoked = true;
      },
      readOnly: () => {
        scopes = ["mcp:read"];
      },
      setGrants: (value) => {
        grants = value;
      },
    });
  } finally {
    await server.dispose();
  }
};

const initialize = async (rpc: Parameters<Parameters<typeof withTools>[0]>[0]["rpc"]) => {
  const response = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  expect(response.status).toBe(200);
  await response.text();
  const sessionId = response.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("Missing MCP session ID");
  return sessionId;
};

describe("SDK-backed local MCP HTTP tools", () => {
  it("opens an encrypted imported key through the CLI resolver and fails closed without its unlock secret", async () => {
    const privateKey = generatePrivateKey();
    const fixture = mcpSignatureFixture(privateKey);
    const directory = await mkdtemp(join(tmpdir(), "namera-mcp-signing-"));
    const secrets = new Map<string, string>();
    let unlocked = false;
    const store = createSessionKeystore(directory, {
      get: (key) => (unlocked ? (secrets.get(key) ?? null) : null),
      set: (key, value) => {
        secrets.set(key, value);
      },
      delete: (key) => {
        secrets.delete(key);
      },
    });
    try {
      const material = Schema.decodeUnknownSync(LocalSessionKeyMaterial)({
        version: 1,
        namespace: "eip155",
        apiOrigin,
        privateKey,
        bindings: [Schema.encodeSync(LocalEvmSessionBinding)(fixture.binding)],
      });
      const passphrase = Redacted.make("test-only encrypted export passphrase");
      const encrypted = await sealLocalSessionKey(material, passphrase);
      await store.importKey(encrypted, passphrase, apiOrigin);
      let completions = 0;
      await withTools(
        async ({ rpc, fetch }) => {
          const sessionId = await initialize(rpc);
          const params = {
            name: "sign",
            arguments: { request: Schema.encodeSync(PrepareSignatureRequest)(fixture.request) },
          };
          const locked = await rpc("tools/call", params, sessionId);
          expect(await locked.json()).toMatchObject({
            result: {
              isError: true,
              structuredContent: { error: { code: "LOCAL_SIGNER_UNAVAILABLE" } },
            },
          });
          expect(fetch.mock.calls.every(([url]) => url.toString().endsWith("/actor"))).toBe(true);
          expect(completions).toBe(0);
          unlocked = true;
          const signed = await rpc("tools/call", params, sessionId);
          expect(await signed.json()).toMatchObject({
            result: {
              structuredContent: {
                signature: { walletId: fixture.binding.walletId, type: "message" },
              },
            },
          });
          expect(completions).toBe(1);
        },
        {
          grants: fixture.grants,
          resolveSigner: makeSessionSignerResolver(store, apiOrigin),
          fetch: async (input, init) => {
            if (input.toString().endsWith("/signatures/prepare"))
              return Response.json(Schema.encodeSync(PrepareSignatureResponse)(fixture.response));
            expect(input.toString()).toContain("/signatures/complete");
            const payload = JSON.parse(new TextDecoder().decode(init?.body as Uint8Array)) as {
              signature: `0x${string}`;
            };
            expect(
              await verifyTypedData({
                ...fixture.response.signing.typedData,
                address: fixture.account.address,
                signature: payload.signature,
              }),
            ).toBe(true);
            completions += 1;
            return Response.json(fixture.complete(payload.signature));
          },
        },
      );
    } finally {
      secrets.clear();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("returns a non-retryable paused-network error without signing", async () => {
    const fixture = mcpSignatureFixture();
    const signTypedData = vi.fn(async (value) =>
      fixture.account.signTypedData(value as TypedDataDefinition),
    );
    await withTools(
      async ({ rpc }) => {
        const sessionId = await initialize(rpc);
        const response = await rpc(
          "tools/call",
          {
            name: "sign",
            arguments: { request: Schema.encodeSync(PrepareSignatureRequest)(fixture.request) },
          },
          sessionId,
        );
        expect(await response.json()).toMatchObject({
          result: {
            isError: true,
            structuredContent: { error: { code: "NETWORK_PAUSED", retryable: false } },
          },
        });
        expect(signTypedData).not.toHaveBeenCalled();
      },
      {
        grants: fixture.grants,
        resolveSigner: async () => ({
          binding: fixture.binding,
          signMessage: (message) => fixture.account.signMessage({ message }),
          signTypedData,
        }),
        fetch: async () =>
          Response.json({ _tag: "SignatureError", code: "NETWORK_PAUSED" }, { status: 409 }),
      },
    );
  });
  it.each(["revoked authorization", "removed grant", "revoked session", "wrong wallet"])(
    "rejects a valid signing request before opening the keystore: %s",
    async (scenario) => {
      const fixture = mcpSignatureFixture();
      await withTools(
        async ({ rpc, signer, fetch, revoke, setGrants }) => {
          const sessionId = await initialize(rpc);
          if (scenario === "revoked authorization") revoke();
          else if (scenario === "removed grant") setGrants([]);
          else
            setGrants(
              fixture.grants.map((grant) => ({
                ...grant,
                sessionKey: {
                  ...grant.sessionKey,
                  ...(scenario === "revoked session"
                    ? { status: "revoked" }
                    : { walletId: otherId }),
                },
              })),
            );

          const response = await rpc(
            "tools/call",
            {
              name: "sign",
              arguments: { request: Schema.encodeSync(PrepareSignatureRequest)(fixture.request) },
            },
            sessionId,
          );
          if (scenario === "revoked authorization") {
            expect(response.status).toBe(401);
            expect(response.headers.get("www-authenticate")).toContain(urls.resourceMetadata);
          } else {
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
              result: {
                isError: true,
                structuredContent: { error: { code: "LOCAL_SIGNER_UNAVAILABLE" } },
              },
            });
          }
          expect(signer).not.toHaveBeenCalled();
          expect(fetch.mock.calls.every(([url]) => url.toString().endsWith("/actor"))).toBe(true);
        },
        { grants: fixture.grants },
      );
    },
  );

  it("signs an authorized exact challenge locally but rejects a substituted payload", async () => {
    const fixture = mcpSignatureFixture();
    const signTypedData = vi.fn((typedData: TypedDataDefinition) =>
      fixture.account.signTypedData(typedData),
    );
    let tamper = true;
    let completions = 0;
    await withTools(
      async ({ rpc, signer }) => {
        const sessionId = await initialize(rpc);
        const params = {
          name: "sign",
          arguments: { request: Schema.encodeSync(PrepareSignatureRequest)(fixture.request) },
        };
        const rejected = await rpc("tools/call", params, sessionId);
        expect(await rejected.json()).toMatchObject({
          result: {
            isError: true,
            structuredContent: { error: { code: "PREPARED_SIGNATURE_INVALID" } },
          },
        });
        expect(signTypedData).not.toHaveBeenCalled();
        expect(completions).toBe(0);
        tamper = false;
        const signed = await rpc("tools/call", params, sessionId);
        expect(await signed.json()).toMatchObject({
          result: {
            structuredContent: {
              signature: { walletId: fixture.binding.walletId, type: "message" },
            },
          },
        });
        expect(signer).toHaveBeenCalledTimes(2);
        expect(signTypedData).toHaveBeenCalledOnce();
        expect(completions).toBe(1);
      },
      {
        grants: fixture.grants,
        resolveSigner: async () => ({
          binding: fixture.binding,
          signMessage: (message) => fixture.account.signMessage({ message }),
          signTypedData,
        }),
        fetch: async (input, init) => {
          if (input.toString().endsWith("/signatures/prepare")) {
            const response = Schema.encodeSync(PrepareSignatureResponse)(fixture.response);
            return Response.json(
              tamper
                ? { ...response, request: { ...response.request, message: "Do something else" } }
                : response,
            );
          }
          expect(input.toString()).toContain("/signatures/complete");
          completions += 1;
          const payload = JSON.parse(new TextDecoder().decode(init?.body as Uint8Array)) as {
            signature: `0x${string}`;
          };
          return Response.json(fixture.complete(payload.signature));
        },
      },
    );
  });
  it("discovers ten tools and carries the live request principal into tool calls", () =>
    withTools(async ({ rpc, fetch }) => {
      const sessionId = await initialize(rpc);
      const listed = await rpc("tools/list", {}, sessionId);
      expect(listed.status).toBe(200);
      const body = (await listed.json()) as {
        result: { tools: { name: string; inputSchema: unknown; outputSchema: unknown }[] };
      };
      expect(body.result.tools).toHaveLength(10);
      for (const tool of body.result.tools) {
        expect(tool.inputSchema).toMatchObject({ type: "object" });
        expect(tool.outputSchema).toMatchObject({ type: "object" });
      }
      const called = await rpc("tools/call", { name: "list_wallets", arguments: {} }, sessionId);
      expect(await called.json()).toMatchObject({ result: { structuredContent: { wallets: [] } } });
      expect(fetch.mock.calls.filter(([url]) => url.toString().endsWith("/actor"))).toHaveLength(3);
      for (const [, options] of fetch.mock.calls) {
        expect(new Headers(options?.headers).get("authorization")).toBe(
          "Bearer upstream-access-token",
        );
        expect(options?.redirect).toBe("error");
        expect(options?.signal).toBeInstanceOf(AbortSignal);
      }
    }));

  it("rejects session reuse by another authorization and checks revocation on every request", () =>
    withTools(async ({ rpc, setAuthorization, revoke }) => {
      const sessionId = await initialize(rpc);
      setAuthorization(otherId);
      expect((await rpc("tools/list", {}, sessionId)).status).toBe(401);
      setAuthorization(id);
      revoke();
      expect((await rpc("tools/list", {}, sessionId)).status).toBe(401);
      const missing = await rpc("tools/list", {}, sessionId, "invalid");
      expect(missing.status).toBe(401);
      expect(missing.headers.get("www-authenticate")).toContain(urls.resourceMetadata);
    }));

  it("does not open an undelegated local signer and returns sanitized tool errors", () =>
    withTools(async ({ rpc, signer }) => {
      const sessionId = await initialize(rpc);
      const response = await rpc(
        "tools/call",
        {
          name: "execute_transaction",
          arguments: {
            namespace: "eip155",
            walletId: id,
            sessionKeyId: otherId,
            chainId: "eip155:1",
            calls: [{ to: "0x1111111111111111111111111111111111111111", value: "0", data: "0x" }],
          },
        },
        sessionId,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        result: {
          isError: true,
          structuredContent: { error: { code: "LOCAL_SIGNER_UNAVAILABLE", retryable: false } },
        },
      });
      expect(signer).not.toHaveBeenCalled();
      const invalid = await rpc("tools/call", { name: "sign", arguments: {} }, sessionId);
      expect(await invalid.json()).toMatchObject({
        result: { isError: true, structuredContent: { error: { code: "INVALID_ARGUMENT" } } },
      });
    }));

  it("applies live scope narrowing before parsing or opening any signer", () =>
    withTools(async ({ rpc, readOnly, signer }) => {
      const sessionId = await initialize(rpc);
      readOnly();
      const response = await rpc("tools/call", { name: "sign", arguments: {} }, sessionId);
      expect(await response.json()).toMatchObject({
        result: { isError: true, structuredContent: { error: { code: "INSUFFICIENT_SCOPE" } } },
      });
      expect(signer).not.toHaveBeenCalled();
    }));
});
