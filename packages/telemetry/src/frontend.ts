import { WebSdk } from "@effect/opentelemetry";
// import { getWebAutoInstrumentations } from "@opentelemetry/auto-instrumentations-web";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { Config, Effect, Layer, Redacted } from "effect";

export const OtelConfig = Config.all({
  otelBaseUrl: Config.url("VITE_OTEL_BASE_URL"),
  otelDataset: Config.string("VITE_OTEL_DATASET").pipe(Config.option),
  otelToken: Config.redacted("VITE_OTEL_API_TOKEN").pipe(Config.option),
});

export type OtelConfigEnvValues = Config.Config.Success<typeof OtelConfig>;

export const OtelWebLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* OtelConfig;

    const headers: Record<string, string> = {};

    if (config.otelDataset._tag === "Some") {
      headers["X-Axiom-Dataset"] = config.otelDataset.value;
    }

    if (config.otelToken._tag === "Some") {
      headers.Authorization = `Bearer ${Redacted.value(config.otelToken.value)}`;
    }

    const metricExporter = new OTLPMetricExporter({
      headers,
      url: `${config.otelBaseUrl}/v1/metrics`,
    });

    const traceExporter = new OTLPTraceExporter({
      headers,
      url: `${config.otelBaseUrl}/v1/traces`,
    });

    const logExporter = new OTLPLogExporter({
      headers,
      url: `${config.otelBaseUrl}/v1/logs`,
    });

    return WebSdk.layer(() => {
      return {
        // instrumentations: [getWebAutoInstrumentations()],
        logRecordProcessor: new BatchLogRecordProcessor(logExporter),
        metricReader: new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 5000, // Export metrics every 5 seconds
        }),
        resource: {
          serviceName: "namera-frontend",
        },
        spanProcessor: [
          new BatchSpanProcessor(traceExporter),
          new BatchSpanProcessor(new ConsoleSpanExporter()),
        ],
      };
    });
  }),
);
