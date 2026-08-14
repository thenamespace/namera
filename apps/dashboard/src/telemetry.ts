import { Atom } from "effect/unstable/reactivity";

import { makeTelemetryLayer, telemetryData } from "@namera-ai/telemetry";

import { env } from "@/env";

const backendUrl = env.backendUrl.endsWith("/") ? env.backendUrl.slice(0, -1) : env.backendUrl;

export const dashboardRuntime = Atom.context();

dashboardRuntime.addGlobalLayer(
  makeTelemetryLayer({
    serviceName: telemetryData.serviceNames.dashboard,
    environment: env.environment,
    serviceVersion: env.telemetryServiceVersion,
    tracesUrl: `${backendUrl}/t/traces/v1`,
    logsUrl: `${backendUrl}/t/logs/v1`,
    metricsUrl: `${backendUrl}/t/metrics/v1`,
  }),
);
