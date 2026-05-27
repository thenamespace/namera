import { NodeSdk } from "@effect/opentelemetry";
import { Effect, Layer, Redacted } from "effect";

import { getWebAutoInstrumentations } from "@opentelemetry/auto-instrumentations-web";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

import * as OtelConfig from "./config";

export const layer = (serviceName: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const config = yield* OtelConfig.OtelConfig;

      let headers: Record<string, string> = {};
      let metricsHeaders: Record<string, string> = {};

      if (config.apiToken) {
        headers["Authorization"] = `Bearer ${Redacted.value(config.apiToken)}`;
        metricsHeaders["Authorization"] =
          `Bearer ${Redacted.value(config.apiToken)}`;
      }

      if (config.dataset) {
        headers["X-Axiom-Dataset"] = config.dataset;
      }

      if (config.metricsDataset) {
        metricsHeaders["X-Axiom-Dataset"] = config.metricsDataset;
      }

      const metricExporter = new OTLPMetricExporter({
        url: config.metricsUrl.toString(),
        headers: metricsHeaders,
      });

      const traceExporter = new OTLPTraceExporter({
        url: config.traceUrl.toString(),
        headers,
      });

      const logExporter = new OTLPLogExporter({
        url: config.logsUrl.toString(),
        headers,
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
