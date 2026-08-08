import { createServer } from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter } from "effect/unstable/http";

import { TelemetryLive } from "@namera-ai/telemetry";

import { ServerConfig } from "#/config";
import { CorsMiddleware } from "#/middlewares/index";
import { ApiReferenceRoutes } from "#/routes/index";

const NodeServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ServerConfig;

    return NodeHttpServer.layer(createServer, {
      host: config.host,
      port: config.port,
    });
  }),
);

const Routes = Layer.mergeAll(ApiReferenceRoutes, CorsMiddleware);

export const ServerLive = HttpRouter.serve(Routes, {
  middleware: HttpMiddleware.tracer,
}).pipe(
  Layer.provide(HttpMiddleware.layerTracerDisabledForUrls(["/reference"])),
  Layer.provide(TelemetryLive),
  Layer.provide(NodeServerLive),
);
