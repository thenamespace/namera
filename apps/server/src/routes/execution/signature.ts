import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const SignatureRoutes = HttpApiBuilder.group(NameraApi, "signature", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("prepare", ({ headers, payload }) =>
        Effect.gen(function* () {
          const data = yield* enforceActor({
            actor: yield* CurrentActor,
            allowedActors: ["api-key", "cli", "mcp"],
            requiredPermissions: {
              "api-key": [],
              cli: ["signature:create"],
              mcp: ["mcp:execute"],
            },
          });
          yield* consumeRateLimit(
            "signature.prepare.actor",
            data.actorId,
            rateLimitPolicy.signature.byApiKey,
          );
          return yield* app.signature.prepare({
            actor: data,
            idempotencyKey: headers["idempotency-key"],
            request: payload,
          });
        }),
      )
      .handle("complete", ({ payload }) =>
        Effect.gen(function* () {
          const data = yield* enforceActor({
            actor: yield* CurrentActor,
            allowedActors: ["api-key", "cli", "mcp"],
            requiredPermissions: {
              "api-key": [],
              cli: ["signature:create"],
              mcp: ["mcp:execute"],
            },
          });
          yield* consumeRateLimit(
            "signature.complete.actor",
            data.actorId,
            rateLimitPolicy.signature.byApiKey,
          );
          return yield* app.signature.complete({ actor: data, request: payload });
        }),
      )
      .handle("verify", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["api-key", "cli", "mcp"],
            requiredPermissions: {
              "api-key": [],
              cli: ["signature:create"],
              mcp: ["mcp:read"],
            },
          });
          yield* consumeRateLimit(
            "signature.verification.actor",
            data.actorId,
            rateLimitPolicy.signature.verificationByActor,
          );
          return yield* app.signature.verify({ actor: data, request: payload });
        }),
      );
  }),
);
