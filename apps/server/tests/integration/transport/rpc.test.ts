import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Predicate } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";

import { Evm } from "@namera-ai/evm";

import { RateLimiterLive } from "#/rate-limit";
import { RpcRoutes } from "#/routes/proxy/rpc";

const UpstreamClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) => {
    if (!Predicate.isTagged(request.body, "Uint8Array")) {
      return Effect.die("Expected the proxy to forward a byte-array body");
    }

    expect(request.url).toBe("https://example.test/1/public");
    expect(request.headers.accept).toBe("application/json");

    return Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(request.body.body, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  }),
);

const TestRpcRoutes = RpcRoutes.pipe(
  HttpRouter.provideRequest(Layer.mergeAll(Evm.testLayer, RateLimiterLive, UpstreamClientLayer)),
);

layer(HttpServer.layerServices)("EIP-155 RPC proxy", (it) => {
  it.effect("forwards the request body and returns the upstream response", () =>
    Effect.gen(function* () {
      const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] });
      const request = HttpClientRequest.post("http://localhost/rpc/eip155/1").pipe(
        HttpClientRequest.bodyText(body, "application/json"),
      );
      const serverRequest = HttpServerRequest.fromClientRequest(request).modify({
        remoteAddress: Option.some("192.0.2.1"),
      });
      const handler = yield* HttpRouter.toHttpEffect(TestRpcRoutes);
      const response = yield* handler.pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest),
      );
      const clientResponse = HttpServerResponse.toClientResponse(response, { request });

      expect(clientResponse.status).toBe(200);
      expect(clientResponse.headers["cache-control"]).toBe("no-store");
      expect(yield* clientResponse.text).toBe(body);
    }),
  );

  it.effect("rejects unsupported chain IDs before contacting the provider", () =>
    Effect.gen(function* () {
      const request = HttpClientRequest.post("http://localhost/rpc/eip155/999999").pipe(
        HttpClientRequest.bodyText(
          JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
          "application/json",
        ),
      );
      const serverRequest = HttpServerRequest.fromClientRequest(request).modify({
        remoteAddress: Option.some("192.0.2.2"),
      });
      const handler = yield* HttpRouter.toHttpEffect(TestRpcRoutes);
      const response = yield* handler.pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest),
      );
      const clientResponse = HttpServerResponse.toClientResponse(response, { request });

      expect(clientResponse.status).toBe(400);
      expect(yield* clientResponse.json).toMatchObject({
        _tag: "UnsupportedChainError",
        namespace: "eip155",
        chainId: "eip155:999999",
      });
    }),
  );
});
