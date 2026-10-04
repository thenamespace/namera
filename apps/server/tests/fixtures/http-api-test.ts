import { Effect, Layer, Option } from "effect";
import type { FileSystem } from "effect/FileSystem";
import {
  HttpClient,
  HttpEffect,
  type HttpPlatform,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import type { HttpApi } from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import type { Client } from "effect/http-api/HttpApiClient";
import type * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import type * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import type { Generator } from "effect/http/Etag";
import type { Path } from "effect/Path";
import type { Scope } from "effect/Scope";

let testClientAddress = 0;

/**
 * Effect's in-memory HttpApi client with the real pre-response phase enabled.
 * This preserves cookies and headers installed by HttpEffect handlers.
 */
export const handledApi = Effect.fnUntraced(function* <
  ApiId extends string,
  Groups extends HttpApiGroup.Constraint,
>(
  api: HttpApi<ApiId, Groups>,
  options?: {
    readonly baseUrl?: string | URL;
    readonly headers?: Readonly<Record<string, string>>;
    readonly remoteAddress?: string;
  },
): Effect.fn.Return<
  Client<Groups>,
  never,
  | HttpApiGroup.ToService<ApiId, Groups>
  | HttpApiGroup.MiddlewareClient<Groups>
  | HttpApiEndpoint.Middleware<HttpApiGroup.Endpoints<Groups>>
  | FileSystem
  | Generator
  | HttpPlatform.HttpPlatform
  | Path
  | Scope
> {
  testClientAddress += 1;
  const remoteAddress = options?.remoteAddress ?? `192.0.2.${testClientAddress}`;
  const context = yield* Effect.context<HttpApiGroup.ToService<ApiId, Groups>>();

  const layer = HttpApiBuilder.layer(api).pipe(
    Layer.provide(Layer.succeedContext(context)),
  ) as Layer.Layer<
    never,
    never,
    FileSystem | Generator | HttpPlatform.HttpPlatform | HttpRouter.HttpRouter | Path
  >;
  const handler = yield* HttpRouter.toHttpEffect(layer);
  const httpClient = HttpClient.make(
    Effect.fnUntraced(function* (request) {
      const serverRequest = HttpServerRequest.fromClientRequest(request).modify({
        ...(options?.headers === undefined
          ? {}
          : { headers: { ...request.headers, ...options.headers } }),
        remoteAddress: Option.some(remoteAddress),
      });
      let handledResponse: HttpServerResponse.HttpServerResponse | undefined;

      yield* HttpEffect.toHandled(handler, (_request, response) =>
        Effect.sync(() => {
          handledResponse = response;
        }),
      ).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, serverRequest));

      if (handledResponse === undefined) {
        return yield* Effect.die("HttpApi handler completed without a response");
      }
      return HttpServerResponse.toClientResponse(handledResponse, { request });
    }, Effect.scoped),
  );

  return yield* HttpApiClient.makeWith(api, {
    httpClient,
    baseUrl: options?.baseUrl ?? "http://localhost:3000",
  });
});
