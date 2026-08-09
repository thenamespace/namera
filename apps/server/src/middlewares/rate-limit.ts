import { Effect, Predicate } from "effect";
import { HttpMiddleware, HttpServerResponse } from "effect/unstable/http";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const RateLimitMiddleware = HttpMiddleware.make((httpEffect) =>
  Effect.gen(function* () {
    const identifier = yield* clientIdentifier;

    return yield* consumeRateLimit("global.ip", identifier, rateLimitPolicy.global).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          Predicate.isTagged(error, "RateLimitExceeded")
            ? Effect.succeed(
                HttpServerResponse.jsonUnsafe(error, {
                  status: 429,
                  headers: {
                    "retry-after": String(error.retryAfterSeconds),
                  },
                }),
              )
            : Effect.succeed(HttpServerResponse.empty({ status: 500 })),
        onSuccess: () => httpEffect,
      }),
    );
  }),
);
