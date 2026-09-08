import { createServer } from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { localMcpRoutes } from "./routes.js";
import type { LocalMcpUrls } from "./transport-security.js";

/** Only literal IPv4 loopback is bindable; there is deliberately no host option. */
export const localMcpListener = (urls: LocalMcpUrls) =>
  HttpRouter.serve(localMcpRoutes(urls), { disableLogger: true, disableListenLog: true }).pipe(
    Layer.provide(
      NodeHttpServer.layer(
        () =>
          createServer({ requestTimeout: 30_000, headersTimeout: 10_000, keepAliveTimeout: 5_000 }),
        { host: urls.hostname, port: urls.port },
      ),
    ),
  );
