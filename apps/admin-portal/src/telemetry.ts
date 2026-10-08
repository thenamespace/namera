import { Layer } from "effect";
import { HttpClient } from "effect/http";
import { Atom } from "effect/reactivity";

import { httpRouteTemplate, makeTelemetryLayer, telemetryData } from "@namera-ai/telemetry";

import { env } from "@/env";

const backendUrl = env.backendUrl.replace(/\/$/, "");
export const adminRuntime = Atom.context();

// Browser exporters only use the server proxy; no collector credentials enter the bundle.
if (import.meta.env.MODE !== "test") {
  adminRuntime.addGlobalLayer(
    makeTelemetryLayer({
      serviceName: telemetryData.serviceNames.adminPortal,
      environment: env.environment,
      serviceVersion: env.telemetryServiceVersion,
      tracesUrl: `${backendUrl}/t/traces/v1`,
      logsUrl: `${backendUrl}/t/logs/v1`,
      metricsUrl: `${backendUrl}/t/metrics/v1`,
      exportInterval: telemetryData.browserExportInterval,
    }),
  );
}
adminRuntime.addGlobalLayer(
  Layer.succeed(HttpClient.SpanNameGenerator)(
    (request) => `http.client ${request.method} ${httpRouteTemplate(request.url)}`,
  ),
);
adminRuntime.addGlobalLayer(
  Layer.succeed(HttpClient.TracerDisabledWhen)(
    (request) => httpRouteTemplate(request.url) === "/internal/me",
  ),
);
