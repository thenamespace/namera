import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiError } from "effect/http-api";

export const requireDashboardOrigin = Effect.fnUntraced(function* (origin: string) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  if (request.headers.origin !== origin) {
    return yield* new HttpApiError.Forbidden();
  }
});
