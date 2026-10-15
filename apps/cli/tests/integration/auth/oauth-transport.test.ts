import { createServer, type Server } from "node:http";

import { OAuthTokenResponse } from "@namera-ai/protocol/dto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { postOAuthForm } from "../../../src/services/oauth-http.js";

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
  new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
afterEach(() => vi.unstubAllGlobals());

describe.each([301, 302, 303, 307, 308])("OAuth HTTP %i", (status) => {
  it.each(["same", "cross"])(
    "does not send device or refresh tokens to a %s-origin redirect",
    async (kind) => {
      let forwarded = 0;
      let requests = 0;
      const target = createServer((_request, response) => {
        forwarded += 1;
        response.end("{}");
      });
      const targetUrl = await listen(target);
      const origin = createServer((request, response) => {
        request.resume();
        if (request.url === "/target") {
          forwarded += 1;
          response.end("{}");
          return;
        }
        requests += 1;
        response
          .writeHead(status, { location: kind === "same" ? "/target" : `${targetUrl}/target` })
          .end();
      });
      try {
        const url = await listen(origin);
        for (const field of ["device_code", "refresh_token"]) {
          // Each request is independent; neither should be retried or redirected.
          // oxlint-disable-next-line no-await-in-loop
          await expect(
            postOAuthForm(
              `${url}/oauth/token`,
              new URLSearchParams({ [field]: "synthetic-secret" }),
              OAuthTokenResponse,
            ),
          ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
        }
        expect(requests).toBe(2);
        expect(forwarded).toBe(0);
      } finally {
        await close(origin);
        await close(target);
      }
    },
  );
});

it.each([
  () => new Response("x".repeat(32 * 1024 + 1)),
  () => Response.json({ access_token: "synthetic-secret", expires_in: -1 }),
  () => new Response("synthetic-secret invalid JSON"),
])("rejects oversized or malformed responses without leaking input", async (response) => {
  const fetch = vi.fn().mockImplementation(async (_input, init: RequestInit) => {
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    return response();
  });
  vi.stubGlobal("fetch", fetch);
  await expect(
    postOAuthForm("https://api.example.com/oauth/token", new URLSearchParams(), OAuthTokenResponse),
  ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  expect(fetch).toHaveBeenCalledOnce();
});
