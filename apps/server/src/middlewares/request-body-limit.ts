import { ByteSize, Effect } from "effect";
import { HttpMiddleware, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

const apiBodyLimit = 2 * 1024 * 1024;
const oauthBodyLimit = 64 * 1024;

export const RequestBodyLimitMiddleware = HttpMiddleware.make((httpEffect) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const pathname = request.url.split("?")[0] ?? request.url;
    const limit = pathname.startsWith("/oauth/") ? oauthBodyLimit : apiBodyLimit;
    const contentLength = request.headers["content-length"];

    if (contentLength !== undefined && Number(contentLength) > limit) {
      return HttpServerResponse.empty({
        status: 413,
        headers: { "cache-control": "no-store" },
      });
    }

    // Node's text/JSON/form/arrayBuffer readers enforce this while consuming
    // chunks, not after allocating the entire body. Content-Length is optional.
    return yield* httpEffect.pipe(
      Effect.provideService(HttpServerRequest.MaxBodySize, ByteSize.bytes(limit)),
    );
  }),
);
