import { Effect } from "effect";
import { HttpMiddleware, HttpServerRequest } from "effect/http";

import { AnalyticsCollection, analyticsOptedOut } from "@namera-ai/telemetry/analytics/collection";
import { ProductAnalytics } from "@namera-ai/telemetry/analytics/server";

export const AnalyticsMiddleware = HttpMiddleware.make((httpEffect) =>
  Effect.gen(function* () {
    const analytics = yield* ProductAnalytics;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const enabled =
      analytics.enabled &&
      !analyticsOptedOut(request.headers) &&
      !request.url.startsWith("/internal");
    return yield* httpEffect.pipe(
      Effect.provideService(AnalyticsCollection, enabled ? "enabled" : "disabled"),
    );
  }),
);
