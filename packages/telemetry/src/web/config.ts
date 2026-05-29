import { Config, Effect, Layer, Context } from "effect";

export const OtelWebEnv = Config.all({
  otelBaseUrl: Config.url("VITE_OTEL_BASE_URL"),
});

export type OtelWebEnv = Config.Success<typeof OtelWebEnv>;

export type OtelWebConfig = {
  metricsUrl: URL;
  traceUrl: URL;
  logsUrl: URL;
};

export const OtelWebConfig = Context.Service<OtelWebConfig>("OtelWebConfig");

const appendOtlpPath = (baseUrl: URL, path: "metrics" | "traces" | "logs") => {
  return new URL(`/telemetry/${path}`, baseUrl);
};

export const layer = Layer.effect(
  OtelWebConfig,
  Effect.gen(function* () {
    const env = yield* OtelWebEnv;

    return {
      metricsUrl: appendOtlpPath(env.otelBaseUrl, "metrics"),
      traceUrl: appendOtlpPath(env.otelBaseUrl, "traces"),
      logsUrl: appendOtlpPath(env.otelBaseUrl, "logs"),
    } satisfies OtelWebConfig;
  }),
);
