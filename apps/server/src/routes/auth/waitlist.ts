import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const WaitlistRoutes = HttpApiBuilder.group(NameraApi, "waitlist", (handlers) =>
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
);
