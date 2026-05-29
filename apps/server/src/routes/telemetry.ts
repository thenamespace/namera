import { Effect, Redacted } from "effect";

import {
  FetchHttpClient,
  HttpBody,
  HttpClient,
  HttpClientResponse,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api } from "@namera-ai/api";
import { InternalError } from "@namera-ai/schema";
import { OtelNodeConfig } from "@namera-ai/telemetry/node";

type TelemetrySignal = "traces" | "metrics" | "logs";

const protobufContentType = "application/x-protobuf";

const isProtobufContentType = (contentType: string) =>
  contentType.toLowerCase().split(";")[0]?.trim() === protobufContentType;

const forwardTelemetry = Effect.fn("forwardTelemetry")(function* ({
  request,
  signal,
}: {
  request: HttpServerRequest.HttpServerRequest;
  signal: TelemetrySignal;
}) {
  const client = yield* HttpClient.HttpClient;
  const config = yield* OtelNodeConfig.OtelNodeConfig;
  const arrayBuffer = yield* request.arrayBuffer.pipe(
    Effect.catch((cause) =>
      Effect.fail(
        new InternalError({
          cause,
          message: "Failed to get arrayBuffer",
        }),
      ),
    ),
  );

  const payload = new Uint8Array(arrayBuffer);
  const contentType = request.headers["content-type"] ?? protobufContentType;

  if (signal === "metrics" && !isProtobufContentType(contentType)) {
    return HttpServerResponse.text(
      "OTLP metrics must use application/x-protobuf; JSON metrics ingestion is not supported.",
      { status: 415 },
    );
  }

  const targetUrl =
    signal === "metrics"
      ? config.metricsUrl
      : signal === "logs"
        ? config.logsUrl
        : config.traceUrl;

  const headers: Record<string, string> = {
    "content-type": contentType,
  };

  if (config.apiToken) {
    headers["authorization"] = `Bearer ${Redacted.value(config.apiToken)}`;
  }

  const dataset = signal === "metrics" ? config.metricsDataset : config.dataset;
  if (dataset) {
    headers["x-axiom-dataset"] = dataset;
  }

  yield* client
    .post(targetUrl, {
      body: HttpBody.uint8Array(payload, contentType),
      headers,
    })
    .pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.catch((cause) =>
        Effect.fail(
          new InternalError({
            cause,
            message: `Failed to forward frontend ${signal}`,
          }),
        ),
      ),
    );

  return HttpServerResponse.empty({ status: 204 });
}, Effect.provide(FetchHttpClient.layer));

export const TelemetryGroupLive = HttpApiBuilder.group(
  api,
  "telemetry",
  (handlers) =>
    handlers
      .handleRaw("traces", ({ request }) =>
        forwardTelemetry({ request, signal: "traces" }),
      )
      .handleRaw("metrics", ({ request }) =>
        forwardTelemetry({ request, signal: "metrics" }),
      )
      .handleRaw("logs", ({ request }) =>
        forwardTelemetry({ request, signal: "logs" }),
      ),
);
