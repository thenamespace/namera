import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform";
import { BunHttpServer } from "@effect/platform-bun";
import { api } from "@namera-ai/api";
import { AuthConfigLive, AuthLive } from "@namera-ai/auth";
import { AdminDatabaseLive, DatabaseLive } from "@namera-ai/database";
import { AuthRepoLive, SessionJanitorLive } from "@namera-ai/domain/auth";
// import { OtelLive } from "@namera-ai/telemetry";
import { Config, Layer } from "effect";

import { HealthGroupLive } from "@/routes/health";

import { EnvLive } from "./env";
import {
  Middlewares,
  openApiMiddleware,
  scalarMiddleware,
} from "./middlewares";
import { AuthGroupLive } from "./routes/auth";

const RepoApiLive = HttpApiBuilder.api(api).pipe(
  Layer.provide(HealthGroupLive),
  Layer.provide(AuthGroupLive),
);

const TracingMiddleware = HttpMiddleware.withTracerDisabledWhen((req) => {
  const url = req.url;

  return (
    req.method === "OPTIONS" ||
    url.startsWith("/health") ||
    url.includes("/auth/me")
  );
});

export const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  // Scalar API Reference
  Layer.provideMerge(scalarMiddleware),
  // OpenAPI Documentation
  Layer.provideMerge(openApiMiddleware),
  // Log the server's listening address
  HttpServer.withLogAddress,
  // Provide API Implementation
  Layer.provide(RepoApiLive),
  // Provide Deps
  Layer.provide(Middlewares),
  Layer.provide(SessionJanitorLive),
  Layer.provide(DatabaseLive),
  Layer.provide(AdminDatabaseLive),
  Layer.provide(AuthLive),
  Layer.provide(AuthRepoLive),
  Layer.provide(AuthConfigLive),
  Layer.provide(EnvLive),
  // Layer.provide(OtelLive),
  TracingMiddleware,
  // Set up the Node.js HTTP server
  Layer.provide(
    BunHttpServer.layerConfig(
      Config.all({
        port: Config.number("PORT").pipe(Config.withDefault(8080)),
      }),
    ),
  ),
);
