import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const ExecutionRoutes = HttpApiBuilder.group(NameraApi, "execution", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers.handle("execute", ({ headers, payload }) =>
      Effect.gen(function* () {
        const actor = yield* CurrentActor;
        const data = yield* enforceActor({
          actor,
          allowedActors: ["api-key"],
        });
        yield* consumeRateLimit(
          "execution.api_key",
          data.apiKey.id,
          rateLimitPolicy.execution.byApiKey,
        );
        return yield* app.execution.execute({
          actor: data,
          idempotencyKey: headers["idempotency-key"],
          request: payload,
        });
      }),
    );
  }),
);
