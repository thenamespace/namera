import { createHash, timingSafeEqual } from "node:crypto";

import { Config, Effect, Layer, Redacted } from "effect";
import { HttpApiError } from "effect/http-api";
import { RateLimiter } from "effect/persistence";

import { AdminAuthorization, CurrentAdmin } from "@namera-ai/api";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

const digest = (value: string) => createHash("sha256").update(value).digest();

export const AdminAuthorizationLive = Layer.effect(
  AdminAuthorization,
  Effect.gen(function* () {
    const limiter = yield* RateLimiter.RateLimiter;
    const token = yield* Config.Redacted("ADMIN_TOKEN").pipe(Config.withDefault(Redacted.make("")));
    const expected = digest(Redacted.value(token));
    return AdminAuthorization.of({
      bearer: Effect.fn("server.admin.authorize")(
        function* (httpEffect, { credential }) {
          yield* consumeRateLimit(
            "admin.bearer.ip",
            yield* clientIdentifier,
            rateLimitPolicy.admin.bearerByIp,
          );
          if (
            Redacted.value(token).length < 32 ||
            !timingSafeEqual(expected, digest(Redacted.value(credential)))
          ) {
            return yield* new HttpApiError.Unauthorized();
          }
          // Per-operation budgets are consumed in the handlers, so a valid
          // bearer is not itself charged against a global ceiling.
          return yield* Effect.provideService(httpEffect, CurrentAdmin, {
            type: "admin",
            credential: "shared-token",
          });
        },
        Effect.provideService(RateLimiter.RateLimiter, limiter),
      ),
    });
  }),
);
