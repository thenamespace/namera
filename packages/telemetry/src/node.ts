import { NodeSdk } from "@effect/opentelemetry";
import { Effect, Layer } from "effect";

import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

import { OtelConfig } from "./config";

export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* OtelConfig;

    const metricsUrl = new URL("/v1/metrics", config.otelBaseUrl);
    const traceUrl = new URL("/v1/traces", config.otelBaseUrl);
    const logsUrl = new URL("/v1/logs", config.otelBaseUrl);

    const metricExporter = new OTLPMetricExporter({
      url: metricsUrl.toString(),
    });

    const traceExporter = new OTLPTraceExporter({
      url: traceUrl.toString(),
    });

    const logExporter = new OTLPLogExporter({
      url: logsUrl.toString(),
    });

    return NodeSdk.layer(() => {
      return {
        instrumentations: [getNodeAutoInstrumentations()],
        logRecordProcessor: new BatchLogRecordProcessor(logExporter),
        metricReader: new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 5000, // Export metrics every 5 seconds
        }),
        resource: {
          serviceName: "namera-backend",
        },
        spanProcessor: [new BatchSpanProcessor(traceExporter)],
      };
    });
  }),
);
