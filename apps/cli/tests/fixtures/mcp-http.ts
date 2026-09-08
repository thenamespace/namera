import { NodeCrypto } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { localMcpHttpSecurity } from "../../src/services/mcp/http-security.js";
import { LocalMcpOAuth } from "../../src/services/mcp/oauth-broker.js";
import { localMcpOAuthRoutes } from "../../src/services/mcp/oauth-routes.js";
import { makeMcpOAuthFixture, urls, verifier } from "./mcp-oauth.js";

export const authorizeMcpHttp = async (
  handler: (request: Request) => Promise<Response>,
  authorization: Readonly<Record<string, string>>,
) => {
  const request = (path: string, init?: RequestInit) =>
    handler(
      new Request(`${urls.origin}${path}`, {
        ...init,
        headers: { host: urls.authority, ...init?.headers },
      }),
    );
  const begin = await request(`/oauth/authorize?${new URLSearchParams(authorization)}`);
  if (begin.status !== 302) throw new Error("Local consent did not redirect");
  const upstream = new URL(begin.headers.get("location") ?? "");
  const callback = await request(
    `/oauth/callback?${new URLSearchParams({
      code: "upstream-code",
      state: upstream.searchParams.get("state") ?? "",
    })}`,
  );
  if (callback.status !== 302) throw new Error("Local callback did not redirect");
  const agent = new URL(callback.headers.get("location") ?? "");
  const tokens = await request("/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: authorization.client_id ?? "",
      redirect_uri: authorization.redirect_uri ?? "",
      resource: urls.resource,
      code: agent.searchParams.get("code") ?? "",
      code_verifier: verifier,
    }),
  });
  if (tokens.status !== 200) throw new Error("Local token exchange failed");
  return (await tokens.json()) as { access_token: string };
};

export const withMcpHttp = async (
  test: (context: {
    readonly request: (path: string, options?: RequestInit) => Promise<Response>;
    readonly fixture: Effect.Success<ReturnType<typeof makeMcpOAuthFixture>>;
  }) => Promise<void>,
) => {
  const fixture = await Effect.runPromise(
    makeMcpOAuthFixture().pipe(Effect.provide(NodeCrypto.layer)),
  );
  const routes = Layer.mergeAll(
    localMcpOAuthRoutes(urls),
    HttpRouter.middleware(localMcpHttpSecurity(urls), { global: true }),
  ).pipe(Layer.provideMerge(Layer.succeed(LocalMcpOAuth, fixture.broker)));
  const server = HttpRouter.toWebHandler(routes, { disableLogger: true });
  const request = (path: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    if (!headers.has("host")) headers.set("host", urls.authority);
    return server.handler(new Request(`${urls.origin}${path}`, { ...options, headers }));
  };
  try {
    await test({ request, fixture });
  } finally {
    await server.dispose();
  }
};
