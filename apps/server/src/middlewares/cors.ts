import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { ServerConfig } from "#/config";

export const CorsMiddleware = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ServerConfig;

    return HttpRouter.cors({
      allowedOrigins: [config.corsOrigin],
      allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "B3", "Traceparent", "Tracestate", "Baggage"],
      credentials: true,
      maxAge: 86400,
    });
  }),
);
