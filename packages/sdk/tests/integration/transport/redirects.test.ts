import { createServer, type Server } from "node:http";

import { describe, expect, it, onTestFinished, vi } from "vitest";

import { NameraClient, type NameraClientConfig, type NameraFetch } from "../../../src/index.js";

const listen = (server: Server) =>
  new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Missing address"));
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    if (!server.listening) return resolve();
    server.closeAllConnections();
    server.close((error) => (error ? reject(error) : resolve()));
  });

const credentials = [
  { name: "API key", config: { apiKey: "synthetic-redirect-key" } },
  { name: "bearer", config: { accessToken: "synthetic-redirect-token" } },
  {
    name: "token supplier",
    config: { getAccessToken: async () => "synthetic-redirect-token" },
  },
] satisfies ReadonlyArray<{ name: string; config: NameraClientConfig }>;

const request = {
  namespace: "eip155",
  walletId: "01a00407-5961-75cf-933e-9cfd0336ec16",
  sessionKeyId: "01a00407-5961-75cf-933e-9cfd0336ec17",
  chainId: "eip155:1",
  calls: [{ to: "0x1111111111111111111111111111111111111111", value: 0n, data: "0x" }],
} as const;

describe.each([301, 302, 303, 307, 308])("HTTP %i redirects", (status) => {
  it.each(["same-origin", "cross-origin"])(
    "rejects %s reads and mutations without forwarding or retrying",
    async (destinationKind) => {
      let destinationRequests = 0;
      let originRequests = 0;
      const destination = createServer((_request, response) => {
        destinationRequests += 1;
        response.setHeader("content-type", "application/json");
        response.end("[]");
      });
      onTestFinished(() => close(destination));
      const destinationUrl = await listen(destination);
      const origin = createServer((incoming, response) => {
        incoming.resume();
        if (incoming.url === "/redirect-target") {
          destinationRequests += 1;
          response.end("[]");
          return;
        }
        originRequests += 1;
        response.writeHead(status, {
          location:
            destinationKind === "same-origin"
              ? "/redirect-target"
              : `${destinationUrl}/redirect-target`,
        });
        response.end();
      });
      onTestFinished(() => close(origin));
      const baseUrl = await listen(origin);
      const resolveSessionSigner = vi.fn();
      const client = new NameraClient({
        apiKey: "synthetic-redirect-key",
        baseUrl,
        resolveSessionSigner,
      });

      expect(await client.wallets.list()).toMatchObject({ success: false, error: { status } });
      expect(await client.executions.execute(request)).toMatchObject({
        success: false,
        error: { status },
      });
      expect(originRequests).toBe(2);
      // No request means no credential, body, or redirected GET disclosure.
      expect(destinationRequests).toBe(0);
      expect(resolveSessionSigner).not.toHaveBeenCalled();
    },
  );
});

describe("custom Fetch redirect contract", () => {
  it.each(credentials)("uses manual redirects with $name credentials", async ({ config }) => {
    const fetch = vi.fn<NameraFetch>().mockImplementation(async (_url, init) => {
      expect(init?.redirect).toBe("manual");
      const headers = new Headers(init?.headers);
      expect(
        config.apiKey === undefined ? headers.get("authorization") : headers.get("x-api-key"),
      ).toBe(config.apiKey ?? "Bearer synthetic-redirect-token");
      return new Response(null, { status: 307, headers: { location: "https://other.example" } });
    });
    const client = new NameraClient({ ...config, fetch });

    expect(await client.wallets.list()).toMatchObject({ success: false, error: { status: 307 } });
    expect(await client.executions.prepare(request)).toMatchObject({
      success: false,
      error: { status: 307 },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["visible", "opaque"])("rejects a %s redirect without retrying", async (kind) => {
    const fetch = vi.fn<NameraFetch>().mockImplementation(async (_url, init) => {
      expect(init?.redirect).toBe("manual");
      // Browsers expose a manual redirect as an opaque response with status zero.
      if (kind === "opaque") return Response.error();
      return new Response(null, { status: 307, headers: { location: "https://example.com" } });
    });
    const client = new NameraClient({ apiKey: "synthetic-redirect-key", fetch });
    expect(await client.executions.prepare(request)).toMatchObject({ success: false });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
