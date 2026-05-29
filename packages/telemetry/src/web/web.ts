import { Effect, Layer } from "effect";

import * as WebSdk from "@effect/opentelemetry/WebSdk";
import { getWebAutoInstrumentations } from "@opentelemetry/auto-instrumentations-web";
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
import * as OtelWebConfig from "./config";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getFetchRequestUrl = (request: Request | RequestInit) => {
  if (request instanceof Request) {
    return request.url;
  }

  if (typeof request === "string") {
    return request;
  }

  if ("url" in request && typeof request.url === "string") {
    return request.url;
  }

  return "/";
};

const getFetchRequestMethod = (request: Request | RequestInit) => {
  if (request instanceof Request) {
    return request.method;
  }
  return request.method ?? "GET";
};

const getBrowserPathname = () => {
  const location = (globalThis as { location?: { pathname?: string } })
    .location;

  return location?.pathname ?? "/";
};

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

      const telemetryOrigin = config.traceUrl.origin;

      return WebSdk.layer(() => {
        return {
          instrumentations: [
            getWebAutoInstrumentations({
              "@opentelemetry/instrumentation-document-load": {
                enabled: false,
              },
              "@opentelemetry/instrumentation-user-interaction": {
                enabled: false,
              },
              "@opentelemetry/instrumentation-fetch": {
                clearTimingResources: true,
                ignoreNetworkEvents: true,
                ignoreUrls: [
                  /\/telemetry(?:\/|$)/,
                  /\/rpc(?:\/|$)/,
                  /\/health$/,
                ],
                propagateTraceHeaderCorsUrls: [
                  new RegExp(`^${escapeRegExp(telemetryOrigin)}`),
                ],
                applyCustomAttributesOnSpan: (span, request) => {
                  const url = getFetchRequestUrl(request);
                  const method = getFetchRequestMethod(request);

                  if (shouldSkipHttpTracing({ method, url })) return;

                  const operation = httpOperationName(method, url);
                  const route = normalizeHttpPath(url);
                  const browserPathname = getBrowserPathname();
                  span.updateName(operation);
                  span.setAttribute("namera.operation", operation);
                  span.setAttribute("http.route", route);
                  span.setAttribute("app.route", browserPathname);
                },
              },
              "@opentelemetry/instrumentation-xml-http-request": {
                enabled: false,
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
          spanProcessor: [new BatchSpanProcessor(traceExporter)],
        };
      });
    }),
  );
