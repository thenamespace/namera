import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

import { AnalyticsCollection } from "@namera-ai/telemetry/analytics/collection";
import { AnalyticsDeliveryError, ProductAnalytics } from "@namera-ai/telemetry/analytics/server";

import { AnalyticsMiddleware } from "#/middlewares/analytics";

it.effect(
  "gates collection before application work for privacy signals, internal routes and disabled environments",
  () =>
    Effect.gen(function* () {
      for (const [enabled, path, headers, expected] of [
        [true, "/waitlist", {}, "enabled"],
        [true, "/waitlist", { "x-namera-analytics": "off" }, "disabled"],
        [true, "/wallets", { dnt: "1" }, "disabled"],
        [true, "/wallets", { "sec-gpc": "1" }, "disabled"],
        [
          true,
          "/wallets",
          { cookie: "auth-token=sentinel;namera_analytics_disabled=true" },
          "disabled",
        ],
        [true, "/internal/me", {}, "disabled"],
        [false, "/waitlist", {}, "disabled"],
      ] as const) {
        const response = yield* AnalyticsMiddleware(
          Effect.map(AnalyticsCollection, (collection) => HttpServerResponse.text(collection)),
        ).pipe(
          Effect.provideService(ProductAnalytics, {
            enabled,
            capture: () => Effect.void,
            deliver: () => Effect.fail(new AnalyticsDeliveryError()),
          }),
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(new Request(`https://api.example.com${path}`, { headers })),
          ),
        );
        expect(responseBody(response)).toBe(expected);
      }
    }),
);

function responseBody(response: HttpServerResponse.HttpServerResponse) {
  return "body" in response.body && response.body.body instanceof Uint8Array
    ? new TextDecoder().decode(response.body.body)
    : undefined;
}
