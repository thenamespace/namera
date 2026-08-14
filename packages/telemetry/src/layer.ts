import { Effect, Layer, type Duration } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import {
  OtlpLogger,
  OtlpMetrics,
  OtlpSerialization,
  OtlpTracer,
} from "effect/unstable/observability";

import { telemetryData } from "#/data";
import { resolveTelemetryExport } from "#/export";

export const makeTelemetryLayer = (options: {
  serviceName: string;
  environment: string;
  serviceVersion: string;
  tracesUrl: string;
  logsUrl: string;
  metricsUrl: string;
  exportInterval?: Duration.Input;
  tracesHeaders?: Readonly<Record<string, string>>;
  logsHeaders?: Readonly<Record<string, string>>;
  metricsHeaders?: Readonly<Record<string, string>>;
}) => {
  const resource = {
    serviceName: options.serviceName,
    serviceVersion: options.serviceVersion,
    attributes: {
      "deployment.environment.name": options.environment,
    },
  };

  return Layer.mergeAll(
    OtlpTracer.layer({
      url: options.tracesUrl,
      headers: options.tracesHeaders,
      resource,
      exportInterval: options.exportInterval ?? telemetryData.exportInterval,
      shutdownTimeout: telemetryData.shutdownTimeout,
    }),
    OtlpLogger.layer({
      url: options.logsUrl,
      headers: options.logsHeaders,
      resource,
      exportInterval: telemetryData.logExportInterval,
      shutdownTimeout: telemetryData.shutdownTimeout,
      mergeWithExisting: true,
    }),
    OtlpMetrics.layer({
      url: options.metricsUrl,
      headers: options.metricsHeaders,
      resource,
      exportInterval: options.exportInterval ?? telemetryData.exportInterval,
      shutdownTimeout: telemetryData.shutdownTimeout,
      temporality: "cumulative",
    }),
  ).pipe(Layer.provide(OtlpSerialization.layerProtobuf), Layer.provide(FetchHttpClient.layer));
};

export const TelemetryLive = Layer.unwrap(
  Effect.gen(function* () {
    const destination = yield* resolveTelemetryExport();

    return makeTelemetryLayer({
      serviceName: telemetryData.serviceNames.server,
      environment: destination.environment,
      serviceVersion: destination.serviceVersion,
      tracesUrl: destination.traces.url,
      logsUrl: destination.logs.url,
      metricsUrl: destination.metrics.url,
      tracesHeaders: destination.traces.headers,
      logsHeaders: destination.logs.headers,
      metricsHeaders: destination.metrics.headers,
    });
  }),
);
