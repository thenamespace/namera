import { expect, it } from "@effect/vitest";
import { Effect, Metric } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";

import { makeTelemetryLayer } from "@namera-ai/telemetry";

for (const runtime of ["browser", "server"] as const) {
  it.effect(`${runtime} retains all signals with independent minute-based metrics`, () =>
    Effect.gen(function* () {
      const requests: Array<{ url: string; body: unknown }> = [];
      const captureFetch: typeof fetch = async (input, init) => {
        requests.push({ url: String(input), body: init?.body });
        return new Response(null, { status: 200 });
      };
      const metrics = () => requests.filter((request) => request.url.endsWith("/metrics"));

      yield* Effect.gen(function* () {
        yield* Metric.update(Metric.counter(`test.telemetry.${runtime}.operations`), 1);
        yield* Effect.logInfo("telemetry.export.test");
        yield* Effect.void.pipe(Effect.withSpan("telemetry.export.test"));

        yield* TestClock.adjust("10 seconds");
        expect(requests.some((request) => request.url.endsWith("/traces"))).toBe(true);
        expect(requests.some((request) => request.url.endsWith("/logs"))).toBe(true);
        expect(metrics()).toHaveLength(0);

        yield* TestClock.adjust("49 seconds");
        expect(metrics()).toHaveLength(0);
        yield* TestClock.adjust("1 second");
        expect(metrics()).toHaveLength(1);
        expect(metrics()[0]?.body).toBeInstanceOf(Uint8Array);

        // Idle cumulative snapshots remain available, but only once per minute.
        yield* TestClock.adjust("60 seconds");
        expect(metrics()).toHaveLength(2);
      }).pipe(
        Effect.provide(
          makeTelemetryLayer({
            serviceName: `test-${runtime}`,
            serviceVersion: "test",
            environment: "test",
            tracesUrl: "https://collector.test/traces",
            logsUrl: "https://collector.test/logs",
            metricsUrl: "https://collector.test/metrics",
            ...(runtime === "browser" ? { exportInterval: "1 second" } : {}),
          }),
        ),
        Effect.provideService(FetchHttpClient.Fetch, captureFetch),
      );

      expect(metrics()).toHaveLength(3);
    }),
  );
}
