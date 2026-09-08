import { createServer } from "node:http";

import { NodeHttpClient, NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter } from "effect/unstable/http";

import { DatabaseMigration } from "@namera-ai/database";
import { httpRouteTemplate, TelemetryLive } from "@namera-ai/telemetry";

import { ServerConfig } from "#/config";
import {
  ApplicationLive,
  BillingWorkerLive,
  EmailWorkerLive,
  ExecutionWorkerLive,
  SessionKeyWorkerLive,
  ServicesLive,
} from "#/layers/services";
import {
  CorsMiddleware,
  RateLimitMiddleware,
  SecurityHeadersMiddleware,
  TelemetryMiddleware,
} from "#/middlewares/index";
import { RateLimiterLive } from "#/rate-limit";
import {
  ApiReferenceRoutes,
  ApiRoutes,
  RootRoutes,
  OAuthProtocolRoutes,
  RpcRoutes,
  TelemetryRoutes,
} from "#/routes/index";

const NodeServerLive = Layer.unwrap(
  Effect.gen(function* () {
    // Never accept traffic against an older schema. Migrations and system-data
    yield* DatabaseMigration;
    const config = yield* ServerConfig;

    return NodeHttpServer.layer(createServer, {
      host: config.host,
      port: config.port,
    });
  }),
).pipe(Layer.provide(DatabaseMigration.layer));

const Routes = Layer.mergeAll(
  ApiReferenceRoutes,
  ApiRoutes,
  CorsMiddleware,
  RootRoutes,
  Layer.merge(RpcRoutes, TelemetryRoutes).pipe(
    HttpRouter.provideRequest(
      Layer.mergeAll(ServicesLive, NodeHttpClient.layerUndici, RateLimiterLive),
    ),
  ),
  OAuthProtocolRoutes.pipe(
    HttpRouter.provideRequest(
      Layer.mergeAll(
        ApplicationLive.pipe(Layer.provide(ServicesLive)),
        ServicesLive,
        RateLimiterLive,
      ),
    ),
  ),
  EmailWorkerLive,
  BillingWorkerLive,
  ExecutionWorkerLive,
  SessionKeyWorkerLive,
);

// ServerLive is the transport composition root. Middleware order is intentional:
// actor authentication runs inside rate limiting and telemetry so rejected and
// accepted requests retain consistent operational context.
export const ServerLive = HttpRouter.serve(Routes, {
  disableLogger: true,
  middleware: (httpEffect) =>
    SecurityHeadersMiddleware(TelemetryMiddleware(RateLimitMiddleware(httpEffect))),
}).pipe(
  Layer.provide(
    HttpMiddleware.layerTracerDisabledForUrls([
      "/reference",
      "/auth/session/me",
      "/t/traces/v1",
      "/t/logs/v1",
      "/t/metrics/v1",
    ]),
  ),
  Layer.provide(
    Layer.succeed(HttpMiddleware.SpanNameGenerator)(
      (request) => `http.server ${request.method} ${httpRouteTemplate(request.url)}`,
    ),
  ),
  Layer.provide(RateLimiterLive),
  Layer.provide(ServicesLive),
  Layer.provide(TelemetryLive),
  Layer.provide(NodeServerLive),
);
