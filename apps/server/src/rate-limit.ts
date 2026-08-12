import { Duration, Effect, Layer, Option, Predicate } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiError } from "effect/unstable/httpapi";
import { RateLimiter } from "effect/unstable/persistence";

import { RateLimitExceeded } from "@namera-ai/protocol";

export const rateLimitPolicy = {
  global: {
    limit: 120,
    window: Duration.minutes(1),
    algorithm: "token-bucket",
  },
  magicLink: {
    requestByIp: {
      limit: 10,
      window: Duration.minutes(15),
      algorithm: "fixed-window",
    },
    requestByEmail: {
      limit: 5,
      window: Duration.minutes(15),
      algorithm: "fixed-window",
    },
    verifyByIp: {
      limit: 20,
      window: Duration.minutes(10),
      algorithm: "fixed-window",
    },
  },
  invitation: {
    createByOrganization: {
      limit: 30,
      window: Duration.hours(1),
      algorithm: "fixed-window",
    },
    createByRecipient: {
      limit: 5,
      window: Duration.hours(1),
      algorithm: "fixed-window",
    },
  },
} as const;

export const RateLimiterLive = RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory));

export const clientIdentifier = Effect.map(HttpServerRequest.HttpServerRequest, (request) =>
  Option.getOrElse(request.remoteAddress, () => "unknown"),
);

export const consumeRateLimit = Effect.fn("consumeRateLimit")(function* (
  scope: string,
  identifier: string,
  policy: {
    readonly limit: number;
    readonly window: Duration.Duration;
    readonly algorithm: "fixed-window" | "token-bucket";
  },
) {
  const limiter = yield* RateLimiter.RateLimiter;

  return yield* limiter
    .consume({
      key: `${scope}:${identifier}`,
      limit: policy.limit,
      window: policy.window,
      algorithm: policy.algorithm,
    })
    .pipe(
      Effect.mapError((error) => {
        if (Predicate.isTagged(error.reason, "RateLimitExceeded")) {
          return new RateLimitExceeded({
            retryAfterSeconds: Math.max(
              1,
              Math.ceil(Duration.toMillis(error.reason.retryAfter) / 1_000),
            ),
          });
        }

        return new HttpApiError.InternalServerError();
      }),
      Effect.tapErrorTag("RateLimitExceeded", () =>
        Effect.logWarning("rate_limit.exceeded").pipe(
          Effect.annotateLogs({ "rate_limit.scope": scope }),
        ),
      ),
    );
});
