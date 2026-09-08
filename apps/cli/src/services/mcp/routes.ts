import { Layer } from "effect";
import { McpProtocol, McpServer } from "effect/unstable/ai";
import { HttpRouter } from "effect/unstable/http";

import { localMcpAuthorization } from "./authorization.js";
import { localMcpHttpSecurity } from "./http-security.js";
import { localMcpOAuthRoutes } from "./oauth-routes.js";
import { localMcpTools } from "./tools.js";
import type { LocalMcpUrls } from "./transport-security.js";

/** One scoped transport and authorization map per loopback listener. */
export const localMcpRoutes = (urls: LocalMcpUrls) => {
  const guard = localMcpHttpSecurity(urls);
  const authorize = localMcpAuthorization(urls);
  return Layer.mergeAll(
    localMcpOAuthRoutes(urls),
    Layer.effectDiscard(localMcpTools).pipe(
      Layer.provide(
        McpServer.layerHttp({
          name: "Namera",
          version: "0.1.0",
          path: "/mcp",
          protocols: [McpProtocol.v2025_06_18],
          allowedOrigins: [urls.origin],
        }),
      ),
    ),
    HttpRouter.middleware((next) => guard(authorize(next)), { global: true }),
  );
};
