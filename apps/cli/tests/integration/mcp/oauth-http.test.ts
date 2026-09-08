import { Effect, Result } from "effect";

import { describe, expect, it } from "vitest";

import { withMcpHttp } from "../../fixtures/mcp-http.js";
import { agentRedirect, apiOrigin, challenge, urls, verifier } from "../../fixtures/mcp-oauth.js";

const form = (params: Record<string, string>): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(params),
});

describe("local MCP OAuth HTTP routes", () => {
  it("advertises the local issuer, completes consent, rotates tokens and revokes", () =>
    withMcpHttp(async ({ request, fixture }) => {
      const discovery = await request("/.well-known/oauth-protected-resource/mcp");
      expect(await discovery.json()).toMatchObject({
        resource: urls.resource,
        authorization_servers: [urls.origin],
      });
      expect(discovery.headers.get("cache-control")).toBe("no-store");
      const issuer = await request("/.well-known/oauth-authorization-server");
      expect(await issuer.json()).toMatchObject({
        issuer: urls.origin,
        code_challenge_methods_supported: ["S256"],
      });
      const registration = await request("/oauth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "http-agent",
          redirect_uris: [agentRedirect],
          grant_types: ["authorization_code", "refresh_token"],
        }),
      });
      expect(registration.status).toBe(201);
      const { client_id: clientId } = (await registration.json()) as { client_id: string };
      const authorize = await request(
        `/oauth/authorize?${new URLSearchParams({
          client_id: clientId,
          redirect_uri: agentRedirect,
          resource: urls.resource,
          response_type: "code",
          code_challenge_method: "S256",
          code_challenge: challenge,
          scope: "mcp:read mcp:execute offline_access",
          state: "agent-state",
        })}`,
      );
      expect(authorize.status).toBe(302);
      const upstream = new URL(authorize.headers.get("location") ?? "");
      expect(upstream.origin).toBe(apiOrigin);
      const callback = await request(
        `/oauth/callback?${new URLSearchParams({ code: "upstream-code", state: upstream.searchParams.get("state") ?? "" })}`,
      );
      expect(callback.status).toBe(302);
      expect(callback.headers.get("referrer-policy")).toBe("no-referrer");
      const agent = new URL(callback.headers.get("location") ?? "");
      expect(agent.searchParams.get("state")).toBe("agent-state");
      const tokenResponse = await request(
        "/oauth/token",
        form({
          grant_type: "authorization_code",
          client_id: clientId,
          redirect_uri: agentRedirect,
          resource: urls.resource,
          code: agent.searchParams.get("code") ?? "",
          code_verifier: verifier,
        }),
      );
      expect(tokenResponse.status).toBe(200);
      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token: string;
      };
      expect(JSON.stringify(tokens)).not.toContain("upstream-");
      const refreshed = await request(
        "/oauth/token",
        form({
          grant_type: "refresh_token",
          client_id: clientId,
          resource: urls.resource,
          refresh_token: tokens.refresh_token,
          scope: "mcp:read offline_access",
        }),
      );
      expect(refreshed.status).toBe(200);
      const next = (await refreshed.json()) as {
        access_token: string;
        refresh_token: string;
        scope: string;
      };
      expect(next.scope).toBe("mcp:read offline_access");
      expect(
        (await request("/oauth/revoke", form({ client_id: clientId, token: next.refresh_token })))
          .status,
      ).toBe(200);
      expect(
        Result.isFailure(
          await Effect.runPromise(
            fixture.broker.authenticate(next.access_token).pipe(Effect.result),
          ),
        ),
      ).toBe(true);
    }));

  it("returns denied consent only through a known one-time callback binding", () =>
    withMcpHttp(async ({ request, fixture }) => {
      const upstream = new URL(
        await Effect.runPromise(fixture.broker.begin(fixture.authorization)),
      );
      const path = `/oauth/callback?${new URLSearchParams({ state: upstream.searchParams.get("state") ?? "", error: "sensitive-upstream-description", error_description: "secret" })}`;
      const response = await request(path);
      expect(response.status).toBe(302);
      const redirect = new URL(response.headers.get("location") ?? "");
      expect(redirect.origin + redirect.pathname).toBe(agentRedirect);
      expect(redirect.searchParams.get("error")).toBe("access_denied");
      expect(redirect.searchParams.get("state")).toBe("agent-state");
      expect(redirect.toString()).not.toContain("secret");
      expect((await request(path)).status).toBe(400);
      const unbound = await request("/oauth/callback?state=unknown&error=access_denied");
      expect(unbound.status).toBe(400);
      expect(unbound.headers.has("location")).toBe(false);
    }));

  it("rejects duplicate parameters, wrong media types, oversized bodies and ambiguous callbacks", () =>
    withMcpHttp(async ({ request }) => {
      const duplicate = await request("/oauth/token", {
        ...form({}),
        body: "client_id=a&client_id=b&grant_type=authorization_code",
      });
      expect(duplicate.status).toBe(400);
      expect(await duplicate.json()).toEqual({ error: "invalid_request" });
      expect((await request("/oauth/authorize?client_id=a&client_id=b")).status).toBe(400);
      expect((await request("/oauth/callback?state=a&code=b&error=c")).status).toBe(400);
      expect((await request("/oauth/register", { method: "POST", body: "{}" })).status).toBe(400);
      expect(
        (await request("/oauth/token", { ...form({}), body: `x=${"x".repeat(33 * 1024)}` })).status,
      ).toBe(400);
      expect(
        (
          await request("/oauth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              client_name: "valid",
              redirect_uris: [agentRedirect],
              padding: "x".repeat(33 * 1024),
            }),
          })
        ).status,
      ).toBe(400);
    }));

  it("blocks foreign host/origin requests and bounds registration attempts", () =>
    withMcpHttp(async ({ request }) => {
      const blocked = await Promise.all(
        [
          { host: "evil.example", "x-forwarded-host": urls.authority },
          { origin: "https://evil.example" },
          { origin: "null" },
          { host: "localhost:3847" },
        ].map((headers) => request("/.well-known/oauth-authorization-server", { headers })),
      );
      expect(blocked.map((response) => response.status)).toEqual([403, 403, 403, 403]);
      const responses = await Promise.all(
        Array.from({ length: 11 }, () => request("/oauth/register", { method: "POST" })),
      );
      expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
      expect(
        responses.find((response) => response.status === 429)?.headers.get("retry-after"),
      ).toBe("60");
      const longUrl = await request(`/oauth/authorize?state=${"x".repeat(8192)}`);
      expect(longUrl.status).toBe(414);
    }));
});
