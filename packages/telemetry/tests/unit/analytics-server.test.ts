import { ConfigProvider, Effect, Layer } from "effect";

import { beforeEach, expect, it, vi } from "vitest";

import { ProductAnalytics } from "../../src/analytics/server.js";

const sdk = vi.hoisted(() => ({
  construct: vi.fn(),
  capture: vi.fn(),
  captureImmediate: vi.fn(),
  shutdown: vi.fn(),
  on: vi.fn(),
}));
vi.mock("posthog-node", () => ({
  PostHog: class {
    constructor(...args: unknown[]) {
      sdk.construct(...args);
    }
    capture = sdk.capture;
    captureImmediate = sdk.captureImmediate;
    shutdown = sdk.shutdown;
    on = sdk.on;
  },
}));

const live = (environment = "production", token = "synthetic-token") =>
  ProductAnalytics.layer.pipe(
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          NODE_ENV: environment,
          POSTHOG_PROJECT_TOKEN: token,
        }),
      ),
    ),
  );
const event = {
  id: "00000000-0000-4000-8000-000000000001",
  timestamp: new Date("2026-10-15T00:00:00Z"),
  event: "api_operation_completed" as const,
  distinctId: "opaque-user",
  properties: { actor_kind: "user", token: "must-not-leak", address: "must-not-leak" },
};

beforeEach(() => {
  vi.resetAllMocks();
  sdk.captureImmediate.mockResolvedValue(undefined);
  sdk.shutdown.mockResolvedValue(undefined);
});

it.each([
  { environment: "development", token: "synthetic-token" },
  { environment: "production", token: "" },
])(
  "does not acknowledge delivery when disabled: $environment/$token",
  async ({ environment, token }) => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const analytics = yield* ProductAnalytics;
        expect(analytics.enabled).toBe(false);
        yield* analytics.capture(event);
        expect(yield* analytics.deliver(event).pipe(Effect.flip)).toMatchObject({
          _tag: "AnalyticsDeliveryError",
        });
      }).pipe(Effect.provide(live(environment, token))),
    );
    expect(sdk.construct).not.toHaveBeenCalled();
  },
);

it("preserves delivery identity while sanitizing properties and closing the SDK", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* (yield* ProductAnalytics).deliver(event);
    }).pipe(Effect.provide(live())),
  );
  expect(sdk.captureImmediate).toHaveBeenCalledExactlyOnceWith({
    uuid: event.id,
    timestamp: event.timestamp,
    distinctId: event.distinctId,
    event: event.event,
    properties: {
      actor_kind: "user",
      surface: "server",
      environment: "production",
      event_version: 1,
      $process_person_profile: true,
    },
  });
  expect(sdk.shutdown).toHaveBeenCalledExactlyOnceWith(5000);
});

it("keeps failed acknowledged delivery retryable without leaking the provider error", async () => {
  sdk.captureImmediate.mockRejectedValue(new Error("synthetic-provider-secret"));
  const error = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* ProductAnalytics).deliver(event).pipe(Effect.flip);
    }).pipe(Effect.provide(live())),
  );
  expect(error).toMatchObject({ _tag: "AnalyticsDeliveryError" });
  expect(JSON.stringify(error)).not.toContain("synthetic-provider-secret");
  expect(sdk.shutdown).toHaveBeenCalledOnce();
});
