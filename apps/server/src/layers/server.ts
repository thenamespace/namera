import { createServer } from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

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

export const ServerLive = HttpRouter.serve(Routes).pipe(Layer.provide(NodeServerLive));
