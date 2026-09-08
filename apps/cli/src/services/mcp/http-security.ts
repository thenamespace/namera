import { Clock, Effect, FileSystem, Option, Semaphore } from "effect";
import {
  HttpIncomingMessage,
  HttpMiddleware,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { acceptsLocalMcpRequest, type LocalMcpUrls } from "./transport-security.js";

export const localMcpResponseHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
} as const;

/** One instance per listener. No forwarded header or DNS resolution grants trust. */
export const localMcpHttpSecurity = (urls: LocalMcpUrls) => {
  const inflight = Semaphore.makeUnsafe(32);
  const limits = {
    register: { start: 0, used: 0, max: 10 },
    oauth: { start: 0, used: 0, max: 120 },
    mcp: { start: 0, used: 0, max: 600 },
  };
  return HttpMiddleware.make((next) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (
        !acceptsLocalMcpRequest(urls, {
          host: request.headers.host,
          origin: request.headers.origin,
        })
      )
        return HttpServerResponse.empty({ status: 403, headers: localMcpResponseHeaders });
      if (request.url.length > 8192)
        return HttpServerResponse.empty({ status: 414, headers: localMcpResponseHeaders });
      const path = request.url.split("?", 1)[0];
      const bucket =
        path === "/oauth/register" ? limits.register : path === "/mcp" ? limits.mcp : limits.oauth;
      const now = yield* Clock.currentTimeMillis;
      if (now >= bucket.start + 60_000 || now < bucket.start) {
        bucket.start = now;
        bucket.used = 0;
      }
      if (bucket.used >= bucket.max)
        return HttpServerResponse.empty({
          status: 429,
          headers: { ...localMcpResponseHeaders, "retry-after": "60" },
        });
      bucket.used += 1;
      const response = yield* next.pipe(
        Effect.provideService(
          HttpIncomingMessage.MaxBodySize,
          FileSystem.KiB(path === "/mcp" ? 256 : 32),
        ),
        inflight.withPermitsIfAvailable(1),
      );
      return Option.isNone(response)
        ? HttpServerResponse.empty({
            status: 503,
            headers: { ...localMcpResponseHeaders, "retry-after": "1" },
          })
        : HttpServerResponse.setHeaders(response.value, localMcpResponseHeaders);
    }),
  );
};
