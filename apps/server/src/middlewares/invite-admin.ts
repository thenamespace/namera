import { createHash, timingSafeEqual } from "node:crypto";

import { Config, Duration, Effect, Layer, Redacted } from "effect";
import { HttpApiError } from "effect/unstable/httpapi";
import { RateLimiter } from "effect/unstable/persistence";

import { InviteAdmin } from "@namera-ai/api";

import { clientIdentifier, consumeRateLimit } from "#/rate-limit";

const digest = (value: string) => createHash("sha256").update(value).digest();

export const InviteAdminLive = Layer.effect(
  InviteAdmin,
  Effect.gen(function* () {
    const limiter = yield* RateLimiter.RateLimiter;
    const token = yield* Config.redacted("INVITE_ADMIN_TOKEN").pipe(
      Config.withDefault(Redacted.make("")),
    );
    const expected = digest(Redacted.value(token));
    return InviteAdmin.of({
      bearer: Effect.fn("server.inviteAdmin.authorize")(
        function* (httpEffect, { credential }) {
          yield* consumeRateLimit("invite-admin.ip", yield* clientIdentifier, {
            limit: 10,
            window: Duration.minutes(1),
            algorithm: "fixed-window",
          });
          if (
            Redacted.value(token).length < 32 ||
            !timingSafeEqual(expected, digest(Redacted.value(credential)))
          ) {
            return yield* new HttpApiError.Unauthorized();
          }
          yield* consumeRateLimit("invite-admin.global", "operator", {
            limit: 30,
            window: Duration.hours(1),
            algorithm: "fixed-window",
          });
          return yield* httpEffect;
        },
        Effect.provideService(RateLimiter.RateLimiter, limiter),
      ),
    });
  }),
);
