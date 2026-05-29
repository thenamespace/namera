import type { Redacted } from "effect/Redacted";

import { Config, Effect, Layer, Context, Option } from "effect";

export const OtelNodeEnv = Config.all({
  otelBaseUrl: Config.url("OTEL_BASE_URL"),
  otelDataset: Config.option(Config.string("OTEL_DATASET")),
  otelMetricsDataset: Config.option(Config.string("OTEL_METRICS_DATASET")),
  apiToken: Config.option(Config.redacted("OTEL_API_TOKEN")),
});

export type OtelNodeEnv = Config.Success<typeof OtelNodeEnv>;

export type OtelNodeConfig = {
  metricsUrl: URL;
  traceUrl: URL;
  logsUrl: URL;
  dataset?: string;
  metricsDataset?: string;
  apiToken?: Redacted<string>;
};

export const OtelNodeConfig = Context.Service<OtelNodeConfig>("OtelNodeConfig");

export const layer = Layer.effect(
  OtelNodeConfig,
  Effect.gen(function* () {
    const env = yield* OtelNodeEnv;

    return {
      metricsUrl: new URL("/v1/metrics", env.otelBaseUrl),
      traceUrl: new URL("/v1/traces", env.otelBaseUrl),
      logsUrl: new URL("/v1/logs", env.otelBaseUrl),
      dataset: Option.getOrUndefined(env.otelDataset),
      metricsDataset: Option.getOrUndefined(env.otelMetricsDataset),
      apiToken: Option.getOrUndefined(env.apiToken),
    };
  }),
);
