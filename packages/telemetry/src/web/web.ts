import { NodeSdk } from "@effect/opentelemetry";
import { Effect, Layer } from "effect";

import { getWebAutoInstrumentations } from "@opentelemetry/auto-instrumentations-web";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

import * as OtelWebConfig from "./config";

export const layer = (serviceName: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const config = yield* OtelWebConfig.OtelWebConfig;

      const metricExporter = new OTLPMetricExporter({
        url: config.metricsUrl.toString(),
      });

      const traceExporter = new OTLPTraceExporter({
        url: config.traceUrl.toString(),
      });

      const logExporter = new OTLPLogExporter({
        url: config.logsUrl.toString(),
      });

      return NodeSdk.layer(() => {
        return {
          instrumentations: [getWebAutoInstrumentations()],
          logRecordProcessor: new BatchLogRecordProcessor(logExporter),
          metricReader: new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: 5000, // Export metrics every 5 seconds
          }),
          resource: {
            serviceName: serviceName,
          },
          spanProcessor: [new BatchSpanProcessor(traceExporter)],
        };
      });
    }),
  );
