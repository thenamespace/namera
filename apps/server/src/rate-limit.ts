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
  apiKey: {
    createByOrganization: {
      limit: 20,
      window: Duration.hours(1),
      algorithm: "fixed-window",
    },
    revokeByOrganization: {
      limit: 60,
      window: Duration.hours(1),
      algorithm: "fixed-window",
    },
  },
  oauth: {
    registerByIp: {
      limit: 20,
      window: Duration.hours(1),
      algorithm: "fixed-window",
    },
    authorizeByIp: {
      limit: 60,
      window: Duration.minutes(1),
      algorithm: "token-bucket",
    },
    tokenByIp: {
      limit: 60,
      window: Duration.minutes(1),
      algorithm: "token-bucket",
    },
  },
  mcp: {
    byAuthorization: {
      limit: 240,
      window: Duration.minutes(1),
      algorithm: "token-bucket",
    },
  },
  sessionKey: {
    revokeByOrganization: {
      limit: 60,
      window: Duration.hours(1),
      algorithm: "fixed-window",
    },
  },
  execution: {
    byApiKey: {
      limit: 120,
      window: Duration.minutes(1),
      algorithm: "token-bucket",
    },
    simulationByActor: {
      limit: 120,
      window: Duration.minutes(1),
      algorithm: "token-bucket",
    },
  },
  signature: {
    byApiKey: {
      limit: 120,
      window: Duration.minutes(1),
      algorithm: "token-bucket",
    },
  },
  rpc: {
    byIp: {
      limit: 600,
      window: Duration.minutes(1),
      algorithm: "token-bucket",
    },
  },
  telemetry: {
    byIp: {
      limit: 600,
      window: Duration.minutes(1),
      algorithm: "token-bucket",
    },
  },
} as const;

export const RateLimiterLive = RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory));

export const clientIdentifier = Effect.map(HttpServerRequest.HttpServerRequest, (request) =>
  Option.getOrElse(request.remoteAddress, () => "unknown"),
);

export const consumeRateLimit = Effect.fnUntraced(function* (
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
