import { request as httpRequest } from "node:http";
import { createServer } from "node:net";

import { NodeCrypto } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime } from "effect";

import { describe, expect, it } from "vitest";

import { LocalMcpApi } from "../../../src/services/mcp/api-client.js";
import { localMcpListener } from "../../../src/services/mcp/listener.js";
import { LocalMcpOAuth } from "../../../src/services/mcp/oauth-broker.js";
import { localMcpUrls } from "../../../src/services/mcp/transport-security.js";
import { apiOrigin, makeMcpOAuthFixture } from "../../fixtures/mcp-oauth.js";

const unusedPort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("Expected TCP address")));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });

describe("local MCP Node listener", () => {
  it("serves guarded discovery, bounds real request bodies, and releases its port", async () => {
    const urls = localMcpUrls(await unusedPort());
    const fixture = await Effect.runPromise(
      makeMcpOAuthFixture().pipe(Effect.provide(NodeCrypto.layer)),
    );
    const runtime = ManagedRuntime.make(
      localMcpListener(urls).pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(LocalMcpOAuth, fixture.broker),
            LocalMcpApi.layer({
              apiOrigin,
              fetch: async () => {
                throw new Error("Unexpected upstream access");
              },
            }),
          ),
        ),
      ),
    );
    const request = (path: string, init?: RequestInit) =>
      fetch(`${urls.origin}${path}`, { ...init, signal: AbortSignal.timeout(5_000) });
    try {
      await runtime.runPromise(Effect.void);
      const discovery = await request("/.well-known/oauth-protected-resource/mcp");
      expect(await discovery.json()).toMatchObject({ resource: urls.resource });
      expect(discovery.headers.get("cache-control")).toBe("no-store");
      const rejected = await request("/.well-known/oauth-protected-resource/mcp", {
        headers: { origin: "https://evil.example" },
      });
      expect(rejected.status).toBe(403);
      await rejected.text();
      // Fetch normalizes Host; exercise a forged wire header using Node HTTP.
      const forgedHost = await new Promise<number | undefined>((resolve, reject) => {
        const socketRequest = httpRequest(
          `${urls.origin}/.well-known/oauth-protected-resource/mcp`,
          {
            headers: { host: "evil.example" },
            timeout: 5_000,
          },
          (response) => {
            response.resume();
            response.once("end", () => resolve(response.statusCode));
          },
        );
        socketRequest.once("error", reject);
        socketRequest.once("timeout", () =>
          socketRequest.destroy(new Error("HTTP request timed out")),
        );
        socketRequest.end();
      });
      expect(forgedHost).toBe(403);
      const challenged = await request("/mcp", { method: "POST", body: "{}" });
      expect(challenged.status).toBe(401);
      expect(challenged.headers.get("www-authenticate")).toContain(urls.resourceMetadata);
      await challenged.text();
      const oversized = await request("/oauth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["https://agent.example/callback"],
          padding: "x".repeat(33 * 1024),
        }),
      });
      expect(oversized.status).toBe(413);
      await oversized.text();
      const chunked = await new Promise<number | "reset">((resolve, reject) => {
        const socketRequest = httpRequest(
          `${urls.origin}/oauth/register`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "transfer-encoding": "chunked" },
            timeout: 5_000,
          },
          (response) => {
            response.resume();
            response.once("end", () => resolve(response.statusCode ?? 0));
            response.once("error", reject);
          },
        );
        socketRequest.once("error", (error: NodeJS.ErrnoException) => {
          // The Node body-size guard may close the socket before OAuth can encode
          // invalid_request. Either outcome must reject this body, not register it.
          if (error.code === "ECONNRESET" || error.code === "EPIPE") resolve("reset");
          else reject(error);
        });
        socketRequest.once("timeout", () =>
          socketRequest.destroy(new Error("Chunked request timed out")),
        );
        socketRequest.write('{"padding":"');
        for (let index = 0; index < 34; index += 1) socketRequest.write("x".repeat(1024));
        socketRequest.end('","redirect_uris":["https://agent.example/callback"]}');
      });
      expect([400, 413, "reset"]).toContain(chunked);
      // Oversized input must not poison the listener for subsequent clients.
      const healthy = await request("/.well-known/oauth-protected-resource/mcp");
      expect(healthy.status).toBe(200);
      await healthy.text();
    } finally {
      await runtime.dispose();
    }
    await expect(request("/.well-known/oauth-protected-resource/mcp")).rejects.toThrow();
  });
});
