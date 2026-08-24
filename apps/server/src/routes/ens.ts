import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const EnsRoutes = HttpApiBuilder.group(NameraApi, "ens", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;

    return handlers.handle("isNameAvailable", ({ query }) =>
      Effect.gen(function* () {
        const identifier = yield* clientIdentifier;
        yield* consumeRateLimit(
          "ens.availability.ip",
          identifier,
          rateLimitPolicy.ens.availabilityByIp,
        );
        return yield* app.ens.isNameAvailable(query);
      }),
    );
  }),
);
