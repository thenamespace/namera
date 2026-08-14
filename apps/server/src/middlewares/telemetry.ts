import { Effect, Metric } from "effect";
import { HttpMiddleware, HttpServerRequest } from "effect/unstable/http";

import {
  httpRouteTemplate,
  httpServerRequestDuration,
  httpServerRequests,
  httpStatusClass,
} from "@namera-ai/telemetry";

export const TelemetryMiddleware = HttpMiddleware.make((httpEffect) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const route = httpRouteTemplate(request.url);
    if (route.startsWith("/t/")) {
      return yield* httpEffect;
    }
    const [duration, response] = yield* Effect.timed(httpEffect);
    const attributes = {
      http_request_method: request.method,
      http_response_status_class: httpStatusClass(response.status),
      http_route: route,
    };

    yield* Metric.update(Metric.withAttributes(httpServerRequests, attributes), 1);
    yield* Metric.update(Metric.withAttributes(httpServerRequestDuration, attributes), duration);

    return response;
  }),
);
