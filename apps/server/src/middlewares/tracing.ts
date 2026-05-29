import { Layer } from "effect";

import { HttpMiddleware } from "effect/unstable/http";

import { shouldSkipHttpTracing } from "@namera-ai/telemetry/http";

export const TracingMiddleware = Layer.succeed(
  HttpMiddleware.TracerDisabledWhen,
)((req) => shouldSkipHttpTracing({ method: req.method, url: req.url }));
