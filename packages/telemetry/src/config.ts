import { Config } from "effect";

export const TelemetryConfig = Config.all({
  environment: Config.string("NODE_ENV").pipe(Config.withDefault("development")),
  serviceVersion: Config.string("TELEMETRY_SERVICE_VERSION").pipe(
    Config.withDefault("development"),
  ),
  localOtlpEndpoint: Config.string("OTEL_EXPORTER_OTLP_ENDPOINT").pipe(
    Config.withDefault("http://localhost:4318"),
  ),
});

export const AxiomConfig = Config.all({
  apiToken: Config.redacted("AXIOM_API_TOKEN"),
  baseUrl: Config.string("AXIOM_OTLP_BASE_URL").pipe(Config.withDefault("https://api.axiom.co")),
  tracesDataset: Config.string("AXIOM_TRACES_DATASET"),
  logsDataset: Config.string("AXIOM_LOGS_DATASET"),
  metricsDataset: Config.string("AXIOM_METRICS_DATASET"),
});
