import { NodeCrypto } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { localMcpHttpSecurity } from "../../src/services/mcp/http-security.js";
import { LocalMcpOAuth } from "../../src/services/mcp/oauth-broker.js";
import { localMcpOAuthRoutes } from "../../src/services/mcp/oauth-routes.js";
import { makeMcpOAuthFixture, urls } from "./mcp-oauth.js";

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
