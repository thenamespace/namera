import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const WaitlistRoutes = Layer.merge(
  HttpApiBuilder.group(NameraApi, "waitlist", (handlers) =>
    Effect.gen(function* () {
      const app = yield* Application;
      return handlers.handle("join", ({ payload }) =>
        Effect.gen(function* () {
          yield* consumeRateLimit(
            "waitlist.ip",
            yield* clientIdentifier,
            rateLimitPolicy.waitlist.byIp,
          );
          yield* consumeRateLimit("waitlist.global", "public", rateLimitPolicy.waitlist.global);
          return yield* app.waitlist.join(payload.email);
        }),
      );
    }),
  ),
  HttpApiBuilder.group(NameraApi, "adminWaitlist", (handlers) =>
    Effect.gen(function* () {
      const app = yield* Application;
      return handlers
        .handle("list", ({ query }) => app.waitlist.list(query))
        .handle("setStatus", ({ params, payload }) =>
          app.waitlist.setStatus(params.id, payload.status),
        );
    }),
  ),
);
