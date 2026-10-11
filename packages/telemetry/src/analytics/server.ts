import { Config, Context, Effect, Layer, Redacted } from "effect";

import { PostHog } from "posthog-node";

import { safeAnalyticsProperties, type AnalyticsProperties } from "./contract.js";

export type ServerAnalyticsEvent = {
  readonly distinctId: string;
  readonly properties: AnalyticsProperties;
};

export class ProductAnalytics extends Context.Service<
  ProductAnalytics,
  {
    readonly capture: (event: ServerAnalyticsEvent) => Effect.Effect<void>;
  }
>()("@namera-ai/telemetry/ProductAnalytics") {
  static readonly layer = Layer.effect(
    ProductAnalytics,
    Effect.gen(function* () {
      const environment = yield* Config.String("NODE_ENV").pipe(Config.withDefault("development"));
      const token = yield* Config.Redacted("POSTHOG_PROJECT_TOKEN").pipe(
        Config.withDefault(Redacted.make("")),
      );
      if (environment !== "production" || !Redacted.value(token))
        return ProductAnalytics.of({ capture: () => Effect.void });

      const client = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const sdk = new PostHog(Redacted.value(token), {
            host: "https://t.namera.ai",
            flushAt: 20,
            flushInterval: 10_000,
            maxQueueSize: 1_000,
            requestTimeout: 5_000,
            fetchRetryCount: 2,
            disableGeoip: true,
          });
          // Never log provider errors: their context can contain ingestion credentials.
          sdk.on("error", () =>
            Effect.runSync(Effect.logWarning("Product analytics delivery failed")),
          );
          return sdk;
        }),
        (sdk) =>
          Effect.tryPromise(() => sdk.shutdown(5_000)).pipe(
            Effect.catch(() => Effect.logWarning("Product analytics shutdown flush failed")),
          ),
      );

      return ProductAnalytics.of({
        capture: (event) =>
          Effect.try(() =>
            client.capture({
              distinctId: event.distinctId,
              event: "api_operation_completed",
              properties: {
                ...safeAnalyticsProperties(event.properties),
                surface: "server",
                environment: "production",
                event_version: 1,
                $process_person_profile: event.properties.actor_kind === "user",
              },
            }),
          ).pipe(Effect.catch(() => Effect.logWarning("Product analytics capture failed"))),
      });
    }),
  );
}
