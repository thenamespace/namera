import { Config, Context, Effect, Layer, Redacted, Schema } from "effect";

import { PostHog } from "posthog-node";

import { safeAnalyticsProperties, type AnalyticsProperties } from "./contract.js";

export class AnalyticsDeliveryError extends Schema.TaggedError<AnalyticsDeliveryError>()(
  "AnalyticsDeliveryError",
  {},
) {}

export type ServerAnalyticsEvent = {
  readonly event?:
    | "api_operation_completed"
    | "simulation_completed"
    | "operation_denied"
    | "signing_failed";
  readonly distinctId: string;
  readonly properties: AnalyticsProperties;
};

export class ProductAnalytics extends Context.Service<
  ProductAnalytics,
  {
    readonly enabled: boolean;
    readonly capture: (event: ServerAnalyticsEvent) => Effect.Effect<void>;
    readonly deliver: (event: {
      readonly id: string;
      readonly timestamp: Date;
      readonly event: string;
      readonly distinctId: string;
      readonly properties: Readonly<Record<string, unknown>>;
    }) => Effect.Effect<void, AnalyticsDeliveryError>;
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
        return ProductAnalytics.of({
          enabled: false,
          capture: () => Effect.void,
          deliver: () => Effect.fail(new AnalyticsDeliveryError()),
        });

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
        enabled: true,
        deliver: (event) =>
          Effect.tryPromise({
            try: () =>
              client.captureImmediate({
                uuid: event.id,
                timestamp: event.timestamp,
                distinctId: event.distinctId,
                event: event.event,
                properties: {
                  ...safeAnalyticsProperties(event.properties),
                  surface: "server",
                  environment: "production",
                  event_version: 1,
                  $process_person_profile: event.properties.actor_kind === "user",
                },
              }),
            catch: () => new AnalyticsDeliveryError(),
          }),
        capture: (event) =>
          Effect.try(() =>
            client.capture({
              distinctId: event.distinctId,
              event: event.event ?? "api_operation_completed",
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
