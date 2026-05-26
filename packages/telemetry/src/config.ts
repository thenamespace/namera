import type { Redacted } from "effect/Redacted";

import { Config, Effect, Layer, Context, Option } from "effect";

export const OtelEnv = Config.all({
  otelBaseUrl: Config.url("OTEL_BASE_URL"),
  otelMetricsBaseUrl: Config.option(Config.url("OTEL_METRICS_BASE_URL")),
  otelDataset: Config.option(Config.string("OTEL_DATASET")),
  otelMetricsDataset: Config.option(Config.string("OTEL_METRICS_DATASET")),
  apiToken: Config.option(Config.redacted("OTEL_API_TOKEN")),
});

export type OtelEnv = Config.Success<typeof OtelEnv>;

export type OtelConfig = {
  metricsUrl: URL;
  traceUrl: URL;
  logsUrl: URL;
  dataset?: string;
  metricsDataset?: string;
  apiToken?: Redacted<string>;
};

export const OtelConfig = Context.Service<OtelConfig>("OtelConfig");

export const layer = Layer.effect(
  OtelConfig,
  Effect.gen(function* () {
    const env = yield* OtelEnv;

    return {
      metricsUrl: new URL(
        "/v1/metrics",
        Option.getOrElse(env.otelMetricsBaseUrl, () => env.otelBaseUrl),
      ),
      traceUrl: new URL("/v1/traces", env.otelBaseUrl),
      logsUrl: new URL("/v1/logs", env.otelBaseUrl),
      dataset: Option.getOrUndefined(env.otelDataset),
      metricsDataset: Option.getOrUndefined(env.otelMetricsDataset),
      apiToken: Option.getOrUndefined(env.apiToken),
    };
  }),
);
