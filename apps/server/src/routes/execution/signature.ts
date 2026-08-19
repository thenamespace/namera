import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const SignatureRoutes = HttpApiBuilder.group(NameraApi, "signature", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers.handle("sign", ({ headers, payload }) =>
      Effect.gen(function* () {
        const actor = yield* CurrentActor;
        const data = yield* enforceActor({
          actor,
          allowedActors: ["api-key", "cli"],
          requiredPermissions: { "api-key": [], cli: ["signature:create"] },
        });
        yield* consumeRateLimit(
          "signature.api_key",
          data.actorId,
          rateLimitPolicy.signature.byApiKey,
        );
        return yield* app.signature.sign({
          actor: data,
          idempotencyKey: headers["idempotency-key"],
          request: payload,
        });
      }),
    );
  }),
);
