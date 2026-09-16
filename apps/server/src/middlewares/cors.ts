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

    return HttpRouter.middleware(
      (httpEffect) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const path = new URL(request.url, "http://localhost").pathname;
          return yield* path === "/waitlist" &&
          (request.method === "POST" || request.method === "OPTIONS")
            ? waitlistCors(httpEffect)
            : dashboardCors(httpEffect);
        }),
      { global: true },
    );
  }),
);
