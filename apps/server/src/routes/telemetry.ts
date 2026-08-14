import { Effect, Layer, Predicate, Result } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpRouter,
  HttpServerResponse,
} from "effect/unstable/http";

import { resolveTelemetryExport, telemetryData } from "@namera-ai/telemetry";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

const routes = [
  { path: "/t/traces/v1", signal: "traces" },
  { path: "/t/logs/v1", signal: "logs" },
  { path: "/t/metrics/v1", signal: "metrics" },
] as const;

const allowedContentTypes = new Set(["application/json", "application/x-protobuf"]);

const makeTelemetryRoute = ({ path, signal }: (typeof routes)[number]) =>
  HttpRouter.add("POST", path, (request) =>
    Effect.gen(function* () {
      const identifier = yield* clientIdentifier;
      const rateLimit = yield* consumeRateLimit(
        "telemetry.proxy.ip",
        identifier,
        rateLimitPolicy.telemetry.byIp,
      ).pipe(Effect.result);

      if (Result.isFailure(rateLimit)) {
        return Predicate.isTagged(rateLimit.failure, "RateLimitExceeded")
          ? HttpServerResponse.empty({
              status: 429,
              headers: {
                "cache-control": "no-store",
                "retry-after": String(rateLimit.failure.retryAfterSeconds),
              },
            })
          : HttpServerResponse.empty({ status: 500 });
      }

      const contentType = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
      if (contentType === undefined || !allowedContentTypes.has(contentType)) {
        return HttpServerResponse.empty({
          status: 415,
          headers: { "cache-control": "no-store" },
        });
      }

      const contentLength = Number(request.headers["content-length"] ?? 0);
      if (Number.isFinite(contentLength) && contentLength > telemetryData.proxyBodyLimit) {
        return HttpServerResponse.empty({
          status: 413,
          headers: { "cache-control": "no-store" },
        });
      }

      const body = new Uint8Array(yield* request.arrayBuffer);
      if (body.byteLength > telemetryData.proxyBodyLimit) {
        return HttpServerResponse.empty({
          status: 413,
          headers: { "cache-control": "no-store" },
        });
      }

      const destination = (yield* resolveTelemetryExport())[signal];
      const httpClient = yield* HttpClient.HttpClient;
      const upstream = yield* httpClient
        .execute(
          HttpClientRequest.post(destination.url).pipe(
            HttpClientRequest.setHeaders(destination.headers),
            HttpClientRequest.setHeader("accept", request.headers.accept ?? contentType),
            HttpClientRequest.bodyUint8Array(body, contentType),
          ),
        )
        .pipe(
          Effect.provideService(HttpClient.TracerDisabledWhen, () => true),
          Effect.flatMap((response) =>
            Effect.map(response.arrayBuffer, (responseBody) => ({
              body: new Uint8Array(responseBody),
              contentType: response.headers["content-type"],
              status: response.status,
            })),
          ),
          Effect.timeout(telemetryData.proxyTimeout),
          Effect.result,
        );

      if (Result.isFailure(upstream)) {
        yield* Effect.logWarning("telemetry.proxy.failed").pipe(
          Effect.annotateLogs({ "telemetry.signal": signal }),
        );

        return HttpServerResponse.empty({
          status: 502,
          headers: { "cache-control": "no-store" },
        });
      }

      return upstream.success.body.byteLength === 0
        ? HttpServerResponse.empty({
            status: upstream.success.status,
            headers: { "cache-control": "no-store" },
          })
        : HttpServerResponse.uint8Array(upstream.success.body, {
            status: upstream.success.status,
            contentType: upstream.success.contentType,
            headers: { "cache-control": "no-store" },
          });
    }).pipe(Effect.withTracerEnabled(false)),
  );

export const TelemetryRoutes = Layer.mergeAll(
  makeTelemetryRoute(routes[0]),
  makeTelemetryRoute(routes[1]),
  makeTelemetryRoute(routes[2]),
);
