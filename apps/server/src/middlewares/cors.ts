import { Effect, Layer, Option } from "effect";
import { HttpMiddleware, HttpRouter, HttpServerRequest } from "effect/unstable/http";

import { ServerConfig } from "#/config";

export const CorsMiddleware = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ServerConfig;

    const dashboardCors = HttpMiddleware.cors({
      allowedOrigins: [config.corsOrigin],
      allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "B3",
        "Traceparent",
        "Tracestate",
        "Baggage",
        "X-API-Key",
        "Idempotency-Key",
      ],
      credentials: true,
      maxAge: 86400,
    });

    const waitlistCors = HttpMiddleware.cors({
      allowedOrigins: [
        config.corsOrigin,
        ...Option.toArray(config.waitlistOrigin).map((url) => url.origin),
      ],
      allowedMethods: ["POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
      credentials: false,
      maxAge: 86400,
    });

    const adminCors = HttpMiddleware.cors({
      allowedOrigins: Option.toArray(config.adminOrigin).map((url) => url.origin),
      allowedMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      // Effect's HTTP client sends tracing headers on every request, so
      // omitting them fails preflight before the request is ever made.
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "B3",
        "Traceparent",
        "Tracestate",
        "Baggage",
      ],
      credentials: false,
      maxAge: 86400,
    });

    return HttpRouter.middleware(
      (httpEffect) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const path = new URL(request.url, "http://localhost").pathname;
          if (path === "/waitlist" && (request.method === "POST" || request.method === "OPTIONS")) {
            return yield* waitlistCors(httpEffect);
          }
          // With no ADMIN_CORS_ORIGIN set, /internal keeps the previous policy
          // so curl and the integration tests behave exactly as before.
          if (path.startsWith("/internal/") && Option.isSome(config.adminOrigin)) {
            return yield* adminCors(httpEffect);
          }
          return yield* dashboardCors(httpEffect);
        }),
      { global: true },
    );
  }),
);
