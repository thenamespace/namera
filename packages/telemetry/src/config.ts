import { Config, Effect, Layer, ServiceMap } from "effect";

export const OtelEnv = Config.all({
  otelBaseUrl: Config.url("OTEL_BASE_URL"),
});

export type OtelEnv = Config.Success<typeof OtelEnv>;

export type OtelConfig = {
  metricsUrl: URL;
  traceUrl: URL;
  logsUrl: URL;
};

export const OtelConfig = ServiceMap.Service<OtelConfig>("OtelConfig");

export const layer = Layer.effect(
  OtelConfig,
  Effect.gen(function* () {
    const env = yield* OtelEnv;

    return {
      metricsUrl: new URL("/v1/metrics", env.otelBaseUrl),
      traceUrl: new URL("/v1/traces", env.otelBaseUrl),
      logsUrl: new URL("/v1/logs", env.otelBaseUrl),
    };
  }),
);
