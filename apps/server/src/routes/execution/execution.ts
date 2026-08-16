import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor, toActorReadScope } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const ExecutionRoutes = HttpApiBuilder.group(NameraApi, "execution", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("execute", ({ headers, payload }) =>
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
      )
      .handle("getSubmission", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["api-key"] });
          return yield* app.execution.getSubmission({
            organizationId: data.organizationId,
            actorId: data.actorId,
            submissionId: params.submissionId,
          });
        }),
      )
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key"],
            requiredPermissions: { user: ["execution:read"], "api-key": [] },
          });
          return yield* app.execution.get({
            ...toActorReadScope(data),
            executionId: params.executionId,
          });
        }),
      )
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key"],
            requiredPermissions: { user: ["execution:read"], "api-key": [] },
          });
          return yield* app.execution.list({
            ...toActorReadScope(data),
            ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          });
        }),
      );
  }),
);
