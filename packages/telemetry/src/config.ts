import { Config } from "effect";

export const TelemetryConfig = Config.all({
  environment: Config.String("NODE_ENV").pipe(Config.withDefault("development")),
  serviceVersion: Config.String("TELEMETRY_SERVICE_VERSION").pipe(
    Config.withDefault("development"),
  ),
  localOtlpEndpoint: Config.String("OTEL_EXPORTER_OTLP_ENDPOINT").pipe(
    Config.withDefault("http://localhost:4318"),
  ),
});

export const AxiomConfig = Config.all({
  apiToken: Config.Redacted("AXIOM_API_TOKEN"),
  baseUrl: Config.String("AXIOM_OTLP_BASE_URL").pipe(Config.withDefault("https://api.axiom.co")),
  tracesDataset: Config.String("AXIOM_TRACES_DATASET"),
  logsDataset: Config.String("AXIOM_LOGS_DATASET"),
  metricsDataset: Config.String("AXIOM_METRICS_DATASET"),
});
