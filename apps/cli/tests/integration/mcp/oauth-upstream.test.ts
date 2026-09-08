import { Effect, Layer, Redacted, Result } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { describe, expect, it } from "vitest";

import { McpOAuthUpstream } from "../../../src/services/mcp/oauth-contracts.js";
import { mcpOAuthUpstreamLayer } from "../../../src/services/mcp/oauth-upstream.js";
import { apiOrigin, urls } from "../../fixtures/mcp-oauth.js";

const upstreamLayer = (fetch: typeof globalThis.fetch) =>
  mcpOAuthUpstreamLayer({ urls, apiOrigin }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  );

const registration = {
  client_id: "upstream-client",
  client_id_issued_at: 1,
  redirect_uris: [urls.callback],
  client_name: "Namera local MCP: Agent",
  token_endpoint_auth_method: "none",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  application_type: "native",
};

describe("local MCP upstream OAuth adapter", () => {
  it("uses only configured API endpoints and API resource, never the local audience", () => {
    const requests: { url: string; body: URLSearchParams | Record<string, unknown> }[] = [];
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const url = String(input);
      expect(init?.redirect).toBe("error");
      expect(url.startsWith(`${apiOrigin}/oauth/`)).toBe(true);
      const bodyText = await new Response(init?.body).text();
      const body = url.endsWith("/register")
        ? (JSON.parse(bodyText) as Record<string, unknown>)
        : new URLSearchParams(bodyText);
      requests.push({ url, body });
      if (url.endsWith("/revoke")) return new Response(null, { status: 200 });
      return Response.json(
        url.endsWith("/register")
          ? registration
          : {
              token_type: "Bearer",
              access_token: "api-access",
              refresh_token: "api-refresh",
              expires_in: 3600,
              scope: "mcp:read offline_access",
            },
      );
    };
    return Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* McpOAuthUpstream;
        expect(yield* provider.register("Agent")).toBe("upstream-client");
        const tokens = yield* provider.exchange({
          clientId: "upstream-client",
          code: "code",
          verifier: Redacted.make("verifier"),
        });
        expect(Redacted.value(tokens.accessToken)).toBe("api-access");
        expect(JSON.stringify(tokens)).not.toContain("api-access");
        yield* provider.refresh({
          clientId: "upstream-client",
          refreshToken: Redacted.make("api-refresh"),
          scopes: ["mcp:read"],
        });
        yield* provider.revoke("upstream-client", Redacted.make("api-refresh"));
        expect(requests[0]?.body).toMatchObject({
          redirect_uris: [urls.callback],
          client_name: "Namera local MCP: Agent",
        });
        for (const request of requests.filter((entry) => entry.url.endsWith("/token"))) {
          expect((request.body as URLSearchParams).get("resource")).toBe(apiOrigin);
          expect((request.body as URLSearchParams).get("client_id")).toBe("upstream-client");
        }
        const exchangeBody = requests[1]?.body;
        const refreshBody = requests[2]?.body;
        if (!(exchangeBody instanceof URLSearchParams) || !(refreshBody instanceof URLSearchParams))
          throw new Error("Expected token request forms");
        expect(exchangeBody.get("redirect_uri")).toBe(urls.callback);
        expect(exchangeBody.get("code_verifier")).toBe("verifier");
        expect(refreshBody.get("scope")).toBe("mcp:read");
      }).pipe(Effect.provide(upstreamLayer(fetch))),
    );
  });

  it.each([
    () => Response.json({ access_token: "secret", token_type: "Bearer", expires_in: -1 }),
    () => new Response("sensitive provider details", { status: 500 }),
    () => new Response("<html>unexpected response</html>"),
  ])("rejects malformed token responses and never exposes provider text", async (response) => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* McpOAuthUpstream)
          .exchange({ clientId: "client", code: "code", verifier: Redacted.make("verifier") })
          .pipe(Effect.result);
      }).pipe(Effect.provide(upstreamLayer(async () => response()))),
    );
    expect(Result.isFailure(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("sensitive provider details");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("rejects a registration response that substitutes the callback", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* (yield* McpOAuthUpstream).register("Agent").pipe(Effect.result);
        expect(Result.isFailure(result)).toBe(true);
      }).pipe(
        Effect.provide(
          upstreamLayer(async () =>
            Response.json({ ...registration, redirect_uris: ["https://evil.example/callback"] }),
          ),
        ),
      ),
    ));
});
