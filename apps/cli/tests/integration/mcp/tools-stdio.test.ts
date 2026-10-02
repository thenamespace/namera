import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  Effect,
  Layer,
  ManagedRuntime,
  Queue,
  Redacted,
  Sink,
  Stdio,
  Stream,
  Schema,
} from "effect";

import { PrepareSignatureResponse } from "@namera-ai/protocol/dto";
import { LocalSessionKeyMaterial, LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import { sealLocalSessionKey, type NameraFetch, type ResolveSessionSigner } from "@namera-ai/sdk";
import { verifyTypedData } from "viem";
import { generatePrivateKey } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";

import { makeMcpApiClient, McpAuthentication } from "../../../src/services/mcp/api-client.js";
import { mcpStdio } from "../../../src/services/mcp/stdio.js";
import { localToolError } from "../../../src/services/mcp/tool-errors.js";
import { makeSessionSignerResolver } from "../../../src/services/session-keystore/resolver.js";
import { createSessionKeystore } from "../../../src/services/session-keystore/storage.js";
import { mcpSignatureFixture } from "../../fixtures/mcp-signature.js";

const id = "01a00407-5961-75cf-933e-9cfd0336ec16";

const harness = async (options?: {
  fixture: ReturnType<typeof mcpSignatureFixture>;
  signer: ResolveSessionSigner;
  fetch: NameraFetch;
}) => {
  const fixture = options?.fixture ?? mcpSignatureFixture();
  let revoked = false;
  let scopes = ["mcp:read", "mcp:execute"];
  let grants = fixture.grants;
  const signer = vi.fn<ResolveSessionSigner>(
    options?.signer ??
      (async () => {
        throw new Error("unexpected signer access");
      }),
  );
  const fetch = vi.fn<NameraFetch>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/actor"))
      return revoked
        ? new Response(null, { status: 401 })
        : Response.json({
            type: "mcp",
            data: {
              actorId: id,
              organizationId: id,
              grants,
              authorization: {
                id,
                clientId: id,
                scopes,
                metadata: { type: "mcp", version: 1 },
                expiresAt: null,
                lastUsedAt: null,
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            },
          });
    if (options?.fetch) return options.fetch(input, init);
    if (path === "/wallets") return Response.json([]);
    throw new Error("Unexpected API path");
  });
  const input = await Effect.runPromise(Queue.make<Uint8Array>());
  const output: Array<{
    id: number;
    result: {
      tools?: Array<{ name: string }>;
      isError?: boolean;
      structuredContent?: unknown;
      content?: Array<{ type: string; text: string }>;
    };
  }> = [];
  let text = "";
  const runtime = ManagedRuntime.make(
    mcpStdio.pipe(
      Layer.provide(
        Layer.succeed(McpAuthentication, {
          principal: makeMcpApiClient(
            { apiOrigin: "https://api.namera.test", fetch, resolveSessionSigner: signer },
            {
              accessToken: Redacted.make("access"),
              clientId: "namera_mcp_test_public_client",
              scopes: ["mcp:read", "mcp:execute"],
            },
          ).pipe(Effect.mapError(() => localToolError("UNAUTHORIZED"))),
        }),
      ),
      Layer.provide(
        Layer.succeed(
          Stdio.Stdio,
          Stdio.make({
            args: Effect.succeed([]),
            stdin: Stream.fromQueue(input),
            stdout: () =>
              Sink.forEach((chunk: string | Uint8Array) =>
                Effect.sync(() => {
                  text += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
                  let newline;
                  while ((newline = text.indexOf("\n")) !== -1) {
                    const line = text.slice(0, newline);
                    text = text.slice(newline + 1);
                    if (line) output.push(JSON.parse(line));
                  }
                }),
              ),
            stderr: () => Sink.drain,
          }),
        ),
      ),
    ),
  );
  await runtime.runPromise(Effect.void);
  let nextId = 0;
  const rpc = async (method: string, params: unknown = {}) => {
    const requestId = ++nextId;
    await Effect.runPromise(
      Queue.offer(
        input,
        new TextEncoder().encode(
          `${JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params })}\n`,
        ),
      ),
    );
    await vi.waitFor(() => expect(output.some((entry) => entry.id === requestId)).toBe(true));
    const response = output.find((entry) => entry.id === requestId);
    if (!response) throw new Error("MCP response was not received.");
    return response.result;
  };
  return {
    rpc,
    signer,
    fetch,
    fixture,
    runtime,
    revoke: () => {
      revoked = true;
    },
    readOnly: () => {
      scopes = ["mcp:read"];
    },
    removeGrants: () => {
      grants = [];
    },
  };
};

describe("stdio MCP authorization and tools", () => {
  it("serializes wallet dates and large integers consistently in structured and text results", async () => {
    const wallet = {
      id,
      organizationId: id,
      namespace: "eip155",
      status: "active",
      implementation: "alchemy-modular-v2",
      metadata: { version: 1, name: "MCP test wallet" },
      address: `0x${"11".repeat(20)}`,
      owner: { signingKeyId: id, custody: "local", algorithm: "p256" },
      data: {
        version: 1,
        modularAccountVersion: "2.0.0",
        validatorType: "webauthn_p256",
        entryPointVersion: "0.7",
        salt: "9007199254740993123456789",
        entityId: 1,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const server = await harness({
      fixture: mcpSignatureFixture(),
      signer: async () => {
        throw new Error("Read tools must not access a signer");
      },
      fetch: async (input) => {
        const path = new URL(String(input)).pathname;
        if (path === "/wallets") return Response.json([wallet]);
        if (path === `/wallets/${id}`) return Response.json(wallet);
        throw new Error("Unexpected wallet endpoint");
      },
    });
    try {
      await server.rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      });
      const listed = await server.rpc("tools/call", { name: "list_wallets", arguments: {} });
      expect(listed.isError).not.toBe(true);
      expect(listed.structuredContent).toEqual({ wallets: [wallet] });
      expect(listed.content).toEqual([
        { type: "text", text: JSON.stringify(listed.structuredContent) },
      ]);
      const fetched = await server.rpc("tools/call", {
        name: "get_wallet",
        arguments: { walletId: id },
      });
      expect(fetched.isError).not.toBe(true);
      expect(fetched.structuredContent).toEqual({ wallet });
      expect(fetched.content).toEqual([
        { type: "text", text: JSON.stringify(fetched.structuredContent) },
      ]);
      expect(server.signer).not.toHaveBeenCalled();
    } finally {
      await server.runtime.dispose();
    }
  });
  it("signs through the imported encrypted keystore and refuses an unavailable unlock secret", async () => {
    const privateKey = generatePrivateKey();
    const fixture = mcpSignatureFixture(privateKey);
    const directory = await mkdtemp(join(tmpdir(), "namera-stdio-key-"));
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
    const apiOrigin = "https://api.namera.test";
    const material = Schema.decodeUnknownSync(LocalSessionKeyMaterial)({
      version: 1,
      namespace: "eip155",
      apiOrigin,
      privateKey,
      bindings: [Schema.encodeSync(LocalEvmSessionBinding)(fixture.binding)],
    });
    const password = Redacted.make("test-only export passphrase");
    let server: Awaited<ReturnType<typeof harness>> | undefined;
    try {
      await store.importKey(await sealLocalSessionKey(material, password), password, apiOrigin);
      let completions = 0;
      server = await harness({
        fixture,
        signer: makeSessionSignerResolver(store, apiOrigin),
        fetch: async (input, init) => {
          if (String(input).endsWith("/signatures/prepare"))
            return Response.json(Schema.encodeSync(PrepareSignatureResponse)(fixture.response));
          expect(String(input)).toContain("/signatures/complete");
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
      });
      await server.rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      });
      const params = { name: "sign", arguments: { request: fixture.request } };
      expect((await server.rpc("tools/call", params)).structuredContent).toMatchObject({
        error: { code: "LOCAL_SIGNER_UNAVAILABLE" },
      });
      expect(completions).toBe(0);
      unlocked = true;
      expect((await server.rpc("tools/call", params)).structuredContent).toMatchObject({
        signature: { walletId: fixture.binding.walletId, type: "message" },
      });
      expect(completions).toBe(1);
    } finally {
      await server?.runtime.dispose();
      secrets.clear();
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("accepts an internal actor client UUID distinct from the public OAuth ID and rechecks live authority", async () => {
    const server = await harness();
    try {
      await server.rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      });
      expect((await server.rpc("tools/list")).tools).toHaveLength(10);
      expect(server.fetch).not.toHaveBeenCalled();
      expect(
        (await server.rpc("tools/call", { name: "list_wallets", arguments: {} })).structuredContent,
      ).toEqual({ wallets: [] });
      server.revoke();
      expect(
        (await server.rpc("tools/call", { name: "list_wallets", arguments: {} })).isError,
      ).toBe(true);
      expect(server.signer).not.toHaveBeenCalled();
    } finally {
      await server.runtime.dispose();
    }
  });
  it("blocks scope narrowing and removed grants before local signer access", async () => {
    const server = await harness();
    try {
      await server.rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      });
      server.removeGrants();
      expect(
        (
          await server.rpc("tools/call", {
            name: "sign",
            arguments: { request: server.fixture.request },
          })
        ).isError,
      ).toBe(true);
      server.readOnly();
      expect(
        (
          await server.rpc("tools/call", {
            name: "sign",
            arguments: { request: server.fixture.request },
          })
        ).structuredContent,
      ).toMatchObject({ error: { code: "INSUFFICIENT_SCOPE" } });
      expect(server.signer).not.toHaveBeenCalled();
    } finally {
      await server.runtime.dispose();
    }
  });
});
