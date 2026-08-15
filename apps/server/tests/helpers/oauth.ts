import { ConfigProvider, Effect, Option } from "effect";
import {
  HttpClient,
  HttpEffect,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import type { RateLimiter } from "effect/unstable/persistence";

import type { Application } from "@namera-ai/application";
import type { CryptoService } from "@namera-ai/crypto";
import type { Repository } from "@namera-ai/database";

import { McpAuthorizationMiddleware } from "#/routes/mcp/authorization";
import { McpRoutes } from "#/routes/mcp/index";
import { OAuthProtocolRoutes } from "#/routes/oauth";

const protocolConfig = ConfigProvider.fromUnknown({
  AUTH_API_PUBLIC_ORIGIN: "http://api.test",
  AUTH_DASHBOARD_PUBLIC_ORIGIN: "http://dashboard.test",
});

export const makeOAuthProtocolClient = Effect.fnUntraced(function* () {
  const handler = yield* HttpRouter.toHttpEffect(OAuthProtocolRoutes);
  const context = yield* Effect.context<Application | RateLimiter.RateLimiter>();
  return HttpClient.make(
    Effect.fnUntraced(function* (request) {
      const serverRequest = HttpServerRequest.fromClientRequest(request).modify({
        remoteAddress: Option.some("192.0.2.250"),
      });
      let handledResponse: HttpServerResponse.HttpServerResponse | undefined;
      yield* HttpEffect.toHandled(
        handler.pipe(
          Effect.provide(context),
          Effect.provideService(ConfigProvider.ConfigProvider, protocolConfig),
        ),
        (_request, response) =>
          Effect.sync(() => {
            handledResponse = response;
          }),
      ).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest));
      if (handledResponse === undefined) {
        return yield* Effect.die("OAuth protocol handler completed without a response");
      }
      return HttpServerResponse.toClientResponse(handledResponse, { request });
    }, Effect.scoped),
  );
});

export const makeMcpProtocolClient = Effect.fnUntraced(function* () {
  const handler = yield* HttpRouter.toHttpEffect(McpRoutes).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, protocolConfig),
  );
  const context = yield* Effect.context<CryptoService | Repository | RateLimiter.RateLimiter>();
  return HttpClient.make(
    Effect.fnUntraced(function* (request) {
      const serverRequest = HttpServerRequest.fromClientRequest(request).modify({
        remoteAddress: Option.some("192.0.2.251"),
      });
      let handledResponse: HttpServerResponse.HttpServerResponse | undefined;
      yield* HttpEffect.toHandled(
        McpAuthorizationMiddleware(handler).pipe(
          Effect.provide(context),
          Effect.provideService(ConfigProvider.ConfigProvider, protocolConfig),
        ),
        (_request, response) =>
          Effect.sync(() => {
            handledResponse = response;
          }),
      ).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest));
      if (handledResponse === undefined) {
        return yield* Effect.die("MCP protocol handler completed without a response");
      }
      return HttpServerResponse.toClientResponse(handledResponse, { request });
    }, Effect.scoped),
  );
});
