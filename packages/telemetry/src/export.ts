import { Effect, Redacted } from "effect";

import { AxiomConfig, TelemetryConfig } from "#/config";

export const resolveTelemetryExport = Effect.fnUntraced(function* () {
  const config = yield* TelemetryConfig;

  if (config.environment !== "production") {
    return {
      environment: config.environment,
      serviceVersion: config.serviceVersion,
      traces: {
        url: `${config.localOtlpEndpoint}/v1/traces`,
        headers: {},
      },
      logs: {
        url: `${config.localOtlpEndpoint}/v1/logs`,
        headers: {},
      },
      metrics: {
        url: `${config.localOtlpEndpoint}/v1/metrics`,
        headers: {},
      },
    };
  }

  const axiom = yield* AxiomConfig;
  const authorization = `Bearer ${Redacted.value(axiom.apiToken)}`;

  return {
    environment: config.environment,
    serviceVersion: config.serviceVersion,
    traces: {
      url: `${axiom.baseUrl}/v1/traces`,
      headers: {
        authorization,
        "x-axiom-dataset": axiom.tracesDataset,
      },
    },
    logs: {
      url: `${axiom.baseUrl}/v1/logs`,
      headers: {
        authorization,
        "x-axiom-dataset": axiom.logsDataset,
      },
    },
    metrics: {
      url: `${axiom.baseUrl}/v1/metrics`,
      headers: {
        authorization,
        "x-axiom-metrics-dataset": axiom.metricsDataset,
      },
    },
  };
});
