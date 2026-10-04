import { Duration, Effect, Predicate, Result } from "effect";
import { HttpClient, HttpClientRequest, HttpRouter, HttpServerResponse } from "effect/http";

import { Evm } from "@namera-ai/evm";
import { UnsupportedChainError } from "@namera-ai/protocol";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const RpcRoutes = HttpRouter.add("POST", "/rpc/eip155/:chainId", (request) =>
  Effect.gen(function* () {
    const identifier = yield* clientIdentifier;
    const rateLimit = yield* consumeRateLimit(
      "rpc.eip155.ip",
      identifier,
      rateLimitPolicy.rpc.byIp,
    ).pipe(Effect.result);

    if (Result.isFailure(rateLimit)) {
      return Predicate.isTagged(rateLimit.failure, "RateLimitExceeded")
        ? HttpServerResponse.jsonUnsafe(rateLimit.failure, {
            status: 429,
            headers: {
              "cache-control": "no-store",
              "retry-after": String(rateLimit.failure.retryAfterSeconds),
            },
          })
        : HttpServerResponse.empty({ status: 500 });
    }

    const params = yield* HttpRouter.params;
    const rawChainId = params.chainId ?? "";

    if (!/^(0|[1-9][0-9]*)$/.test(rawChainId)) {
      return HttpServerResponse.jsonUnsafe(
        new UnsupportedChainError({
          namespace: "eip155",
          chainId: `eip155:${rawChainId}`,
        }),
        {
          status: 400,
          headers: { "cache-control": "no-store" },
        },
      );
    }

    const chainId = Number(rawChainId);
    if (!Number.isSafeInteger(chainId)) {
      return HttpServerResponse.jsonUnsafe(
        new UnsupportedChainError({
          namespace: "eip155",
          chainId: `eip155:${rawChainId}`,
        }),
        {
          status: 400,
          headers: { "cache-control": "no-store" },
        },
      );
    }

    const evm = yield* Evm;
    const rpcUrl = yield* evm.getRpcUrl(chainId, "public").pipe(Effect.result);
    if (Result.isFailure(rpcUrl)) {
      return HttpServerResponse.jsonUnsafe(rpcUrl.failure, {
        status: 400,
        headers: { "cache-control": "no-store" },
      });
    }

    const body = new Uint8Array(yield* request.arrayBuffer);
    const httpClient = yield* HttpClient.HttpClient;
    const upstream = yield* httpClient
      .execute(
        HttpClientRequest.post(rpcUrl.success).pipe(
          HttpClientRequest.setHeader("accept", "application/json"),
          HttpClientRequest.bodyUint8Array(
            body,
            request.headers["content-type"] ?? "application/json",
          ),
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
        Effect.timeout(Duration.seconds(30)),
        Effect.result,
      );

    if (Result.isFailure(upstream)) {
      yield* Effect.logWarning("rpc.proxy.failed").pipe(
        Effect.annotateLogs({
          "rpc.chain_id": chainId,
          "rpc.namespace": "eip155",
        }),
      );

      return HttpServerResponse.jsonUnsafe(
        {
          error: {
            code: "RPC_UPSTREAM_UNAVAILABLE",
            message: "RPC upstream is unavailable",
          },
        },
        {
          status: 502,
          headers: { "cache-control": "no-store" },
        },
      );
    }

    return HttpServerResponse.uint8Array(upstream.success.body, {
      status: upstream.success.status,
      contentType: upstream.success.contentType,
      headers: { "cache-control": "no-store" },
    });
  }),
);
