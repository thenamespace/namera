import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform";
import { BunHttpServer } from "@effect/platform-bun";
import { api } from "@repo/api";
import { Config, Layer } from "effect";

import { HealthGroupLive } from "@/routes/health";

import { openApiMiddleware, scalarMiddleware } from "./middlewares";
import { AuthGroupLive } from "./routes/auth";

const RepoApiLive = HttpApiBuilder.api(api).pipe(
  Layer.provide(HealthGroupLive),
  Layer.provide(AuthGroupLive),
);

export const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  // Scalar API Reference
  Layer.provideMerge(scalarMiddleware),
  // OpenAPI Documentation
  Layer.provideMerge(openApiMiddleware),
  // Log the server's listening address
  HttpServer.withLogAddress,
  // Set up the Node.js HTTP server
  Layer.provide(
    BunHttpServer.layerConfig(
      Config.all({
        port: Config.number("PORT").pipe(Config.withDefault(8080)),
      }),
    ),
  ),
  // Provide API Implementation
  Layer.provide(RepoApiLive),
);
