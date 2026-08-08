import { Effect, Layer, Redacted } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import {
  OtlpLogger,
  OtlpMetrics,
  OtlpSerialization,
  OtlpTracer,
} from "effect/unstable/observability";

import { AxiomConfig, TelemetryConfig } from "#/config";
import { telemetryData } from "#/data";

const makeExporters = (options: {
  environment: string;
  serviceVersion: string;
  tracesUrl: string;
  logsUrl: string;
  metricsUrl: string;
  tracesHeaders?: Readonly<Record<string, string>>;
  logsHeaders?: Readonly<Record<string, string>>;
  metricsHeaders?: Readonly<Record<string, string>>;
}) => {
  const resource = {
    serviceName: telemetryData.serviceName,
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
      exportInterval: telemetryData.exportInterval,
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
      exportInterval: telemetryData.exportInterval,
      shutdownTimeout: telemetryData.shutdownTimeout,
      temporality: "cumulative",
    }),
  ).pipe(Layer.provide(OtlpSerialization.layerProtobuf), Layer.provide(FetchHttpClient.layer));
};

export const TelemetryLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* TelemetryConfig;

    if (config.environment !== "production") {
      return makeExporters({
        environment: config.environment,
        serviceVersion: config.serviceVersion,
        tracesUrl: `${config.localOtlpEndpoint}/v1/traces`,
        logsUrl: `${config.localOtlpEndpoint}/v1/logs`,
        metricsUrl: `${config.localOtlpEndpoint}/v1/metrics`,
      });
    }

    const axiom = yield* AxiomConfig;
    const authorization = `Bearer ${Redacted.value(axiom.apiToken)}`;

    return makeExporters({
      environment: config.environment,
      serviceVersion: config.serviceVersion,
      tracesUrl: `${axiom.baseUrl}/v1/traces`,
      logsUrl: `${axiom.baseUrl}/v1/logs`,
      metricsUrl: `${axiom.baseUrl}/v1/metrics`,
      tracesHeaders: {
        authorization,
        "x-axiom-dataset": axiom.tracesDataset,
      },
      logsHeaders: {
        authorization,
        "x-axiom-dataset": axiom.logsDataset,
      },
      metricsHeaders: {
        authorization,
        "x-axiom-metrics-dataset": axiom.metricsDataset,
      },
    });
  }),
);
