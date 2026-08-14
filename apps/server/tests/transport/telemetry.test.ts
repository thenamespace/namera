import { expect, layer } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Option, Predicate } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { RateLimiterLive } from "#/rate-limit";
import { TelemetryRoutes } from "#/routes/telemetry";

const LocalTelemetryConfig = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    NODE_ENV: "development",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.test",
  }),
);

const UpstreamClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) => {
    if (!Predicate.isTagged(request.body, "Uint8Array")) {
      return Effect.die("Expected the telemetry proxy to forward a byte-array body");
    }

    expect(request.url).toMatch(/^https:\/\/collector\.test\/v1\/(traces|logs|metrics)$/);
    expect(request.headers["content-type"]).toBe("application/x-protobuf");
    expect(request.headers.authorization).toBeUndefined();

    return Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(request.body.body, {
          status: 200,
          headers: { "content-type": "application/x-protobuf" },
        }),
      ),
    );
  }),
);

const TestTelemetryRoutes = TelemetryRoutes.pipe(
  HttpRouter.provideRequest(
    Layer.mergeAll(LocalTelemetryConfig, RateLimiterLive, UpstreamClientLayer),
  ),
);

const ProductionTelemetryConfig = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    NODE_ENV: "production",
    AXIOM_API_TOKEN: "test-token",
    AXIOM_OTLP_BASE_URL: "https://axiom.test",
    AXIOM_TRACES_DATASET: "traces-test",
    AXIOM_LOGS_DATASET: "logs-test",
    AXIOM_METRICS_DATASET: "metrics-test",
  }),
);

const AxiomClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) => {
    expect(request.url).toBe("https://axiom.test/v1/metrics");
    expect(request.headers.authorization).toBe("Bearer test-token");
    expect(request.headers["x-axiom-metrics-dataset"]).toBe("metrics-test");

    return Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null, { status: 200 })));
  }),
);

const TestAxiomTelemetryRoutes = TelemetryRoutes.pipe(
  HttpRouter.provideRequest(
    Layer.mergeAll(ProductionTelemetryConfig, RateLimiterLive, AxiomClientLayer),
  ),
);

layer(HttpServer.layerServices)("telemetry proxy", (it) => {
  it.effect("forwards browser OTLP signals to the configured collector", () =>
    Effect.gen(function* () {
      const handler = yield* HttpRouter.toHttpEffect(TestTelemetryRoutes);

      for (const signal of ["traces", "logs", "metrics"] as const) {
        const body = new Uint8Array([1, 2, 3]);
        const request = HttpClientRequest.post(`http://localhost/t/${signal}/v1`).pipe(
          HttpClientRequest.bodyUint8Array(body, "application/x-protobuf"),
        );
        const serverRequest = HttpServerRequest.fromClientRequest(request).modify({
          remoteAddress: Option.some(`192.0.2.${signal.length}`),
        });
        const response = yield* handler.pipe(
          Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest),
        );
        const clientResponse = HttpServerResponse.toClientResponse(response, { request });

        expect(clientResponse.status).toBe(200);
        expect(clientResponse.headers["cache-control"]).toBe("no-store");
        expect(Array.from(new Uint8Array(yield* clientResponse.arrayBuffer))).toEqual([1, 2, 3]);
      }
    }),
  );

  it.effect("rejects unsupported telemetry content types", () =>
    Effect.gen(function* () {
      const request = HttpClientRequest.post("http://localhost/t/traces/v1").pipe(
        HttpClientRequest.bodyText("not otlp", "text/plain"),
      );
      const serverRequest = HttpServerRequest.fromClientRequest(request).modify({
        remoteAddress: Option.some("192.0.2.20"),
      });
      const handler = yield* HttpRouter.toHttpEffect(TestTelemetryRoutes);
      const response = yield* handler.pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest),
      );

      expect(response.status).toBe(415);
      expect(response.headers["cache-control"]).toBe("no-store");
    }),
  );

  it.effect("adds Axiom authorization and the signal dataset on the server", () =>
    Effect.gen(function* () {
      const request = HttpClientRequest.post("http://localhost/t/metrics/v1").pipe(
        HttpClientRequest.bodyUint8Array(new Uint8Array([1]), "application/x-protobuf"),
      );
      const serverRequest = HttpServerRequest.fromClientRequest(request).modify({
        remoteAddress: Option.some("192.0.2.30"),
      });
      const handler = yield* HttpRouter.toHttpEffect(TestAxiomTelemetryRoutes);
      const response = yield* handler.pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest),
      );

      expect(response.status).toBe(200);
    }),
  );
});
