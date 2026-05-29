import type { IncomingMessage, RequestOptions } from "node:http";

import { Effect, Layer, Redacted } from "effect";

import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

import {
  httpOperationName,
  normalizeHttpPath,
  shouldSkipHttpTracing,
} from "../http-names";
import { FilteringSpanProcessor, isLowLevelDatabaseSpan } from "../span-filter";
import * as OtelNodeConfig from "./config";

const getOutgoingUrl = (request: RequestOptions) => {
  const protocol = request.protocol ?? "http:";
  const host = request.hostname ?? request.host ?? "localhost";
  const path = request.path ?? "/";

  return `${protocol}//${host}${path}`;
};

const getIncomingUrl = (request: IncomingMessage) =>
  request.url ? new URL(request.url, "http://namera.local").toString() : "/";

export const layer = (serviceName: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const config = yield* OtelNodeConfig.OtelNodeConfig;

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

      const spanProcessor = new BatchSpanProcessor(traceExporter);

      return NodeSdk.layer(() => {
        return {
          instrumentations: [
            getNodeAutoInstrumentations({
              "@opentelemetry/instrumentation-fs": {
                enabled: false,
              },
              "@opentelemetry/instrumentation-pg": {
                enabled: config.lowLevelDbSpans,
              },
              "@opentelemetry/instrumentation-http": {
                ignoreIncomingRequestHook: (request) =>
                  shouldSkipHttpTracing({
                    method: request.method,
                    url: request.url ?? "/",
                  }),
                ignoreOutgoingRequestHook: (request) =>
                  shouldSkipHttpTracing({
                    method: request.method,
                    url: getOutgoingUrl(request),
                  }),
                applyCustomAttributesOnSpan: (span, request) => {
                  const method = "method" in request ? request.method : "GET";
                  const url =
                    "url" in request
                      ? getIncomingUrl(request)
                      : getOutgoingUrl(request);
                  const operation = httpOperationName(method, url);
                  span.updateName(operation);
                  span.setAttribute("namera.operation", operation);
                  span.setAttribute("http.route", normalizeHttpPath(url));
                },
              },
            }),
          ],
          logRecordProcessor: new BatchLogRecordProcessor(logExporter),
          metricReader: new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: 5000, // Export metrics every 5 seconds
          }),
          resource: {
            serviceName: serviceName,
          },
          spanProcessor: [
            config.lowLevelDbSpans
              ? spanProcessor
              : new FilteringSpanProcessor(
                  spanProcessor,
                  isLowLevelDatabaseSpan,
                ),
          ],
        };
      });
    }),
  ).pipe(Layer.provideMerge(OtelNodeConfig.layer));
