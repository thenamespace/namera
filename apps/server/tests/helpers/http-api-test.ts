import { Effect, Layer } from "effect";
import type { FileSystem } from "effect/FileSystem";
import type { Path } from "effect/Path";
import type { Scope } from "effect/Scope";
import {
  HttpClient,
  HttpEffect,
  type HttpPlatform,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import type { Generator } from "effect/unstable/http/Etag";
import type { HttpApi } from "effect/unstable/httpapi/HttpApi";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import type { Client } from "effect/unstable/httpapi/HttpApiClient";
import type * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import type * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

/**
 * Effect's in-memory HttpApi client with the real pre-response phase enabled.
 * This preserves cookies and headers installed by HttpEffect handlers.
 */
export const handledApi = Effect.fnUntraced(function* <
  ApiId extends string,
  Groups extends HttpApiGroup.Constraint,
>(
  api: HttpApi<ApiId, Groups>,
  options?: { readonly baseUrl?: string | URL },
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
      const serverRequest = HttpServerRequest.fromClientRequest(request);
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
