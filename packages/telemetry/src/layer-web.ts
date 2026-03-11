import { WebSdk } from "@effect/opentelemetry";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { Effect, Layer, Redacted } from "effect";

import { OtelConfig } from "./config";

export const OtelWebLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* OtelConfig;

    const headers: Record<string, string> = {};

    if (config.dataset._tag === "Some") {
      headers["X-Axiom-Dataset"] = config.dataset.value;
    }

    if (config.token._tag === "Some") {
      headers.Authorization = `Bearer ${Redacted.value(config.token.value)}`;
    }

    const metricExporter = new OTLPMetricExporter({
      headers,
      url: `${config.baseUrl}/v1/metrics`,
    });

    const traceExporter = new OTLPTraceExporter({
      headers,
      url: `${config.baseUrl}/v1/traces`,
    });

    const logExporter = new OTLPLogExporter({
      headers,
      url: `${config.baseUrl}/v1/logs`,
    });

    return WebSdk.layer(() => {
      return {
        logRecordProcessor: new BatchLogRecordProcessor(logExporter),
        metricReader: new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 5000, // Export metrics every 5 seconds
        }),
        resource: {
          serviceName: "namera",
        },
        spanProcessor: [
          new BatchSpanProcessor(traceExporter),
          new BatchSpanProcessor(new ConsoleSpanExporter()),
        ],
      };
    });
  }),
);
