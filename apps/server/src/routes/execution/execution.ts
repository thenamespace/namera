import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import {
  enforceActor,
  toActorReadScope,
  toExecutionDetailsResponse,
  toExecutionListItemResponse,
} from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const ExecutionRoutes = HttpApiBuilder.group(NameraApi, "execution", (handlers) =>
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
              cli: ["execution:execute"],
              mcp: ["mcp:execute"],
            },
          });
          yield* consumeRateLimit(
            "execution.prepare.actor",
            data.actorId,
            rateLimitPolicy.execution.byApiKey,
          );
          return yield* app.execution.prepare({
            actor: data,
            request: payload,
            idempotencyKey: headers["idempotency-key"],
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
              cli: ["execution:execute"],
              mcp: ["mcp:execute"],
            },
          });
          yield* consumeRateLimit(
            "execution.complete.actor",
            data.actorId,
            rateLimitPolicy.execution.byApiKey,
          );
          return yield* app.execution.complete({ actor: data, request: payload });
        }),
      )
      .handle("simulate", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["api-key", "cli", "mcp"],
            requiredPermissions: {
              "api-key": [],
              cli: ["execution:execute"],
              mcp: ["mcp:execute"],
            },
          });
          yield* consumeRateLimit(
            "execution.simulation.actor",
            data.actorId,
            rateLimitPolicy.execution.simulationByActor,
          );
          return yield* app.execution.simulate({ actor: data, request: payload });
        }),
      )
      .handle("execute", ({ headers, payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["api-key", "cli", "mcp"],
            requiredPermissions: {
              "api-key": [],
              cli: ["execution:execute"],
              mcp: ["mcp:execute"],
            },
          });
          yield* consumeRateLimit(
            "execution.api_key",
            data.actorId,
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
          const data = yield* enforceActor({
            actor,
            allowedActors: ["api-key", "cli", "mcp"],
            requiredPermissions: { "api-key": [], cli: ["execution:read"], mcp: ["mcp:read"] },
          });
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
            allowedActors: ["user", "api-key", "cli", "mcp"],
            requiredPermissions: {
              user: ["execution:read"],
              "api-key": [],
              cli: ["execution:read"],
              mcp: ["mcp:read"],
            },
          });
          const result = yield* app.execution.get({
            ...toActorReadScope(data),
            executionId: params.executionId,
          });
          return toExecutionDetailsResponse(result);
        }),
      )
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user", "api-key", "cli", "mcp"],
            requiredPermissions: {
              user: ["execution:read"],
              "api-key": [],
              cli: ["execution:read"],
              mcp: ["mcp:read"],
            },
          });
          const result = yield* app.execution.list({
            ...toActorReadScope(data),
            ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
            ...(query.walletId === undefined ? {} : { walletId: query.walletId }),
            ...(query.sessionKeyId === undefined ? {} : { sessionKeyId: query.sessionKeyId }),
          });
          return {
            items: result.items.map(toExecutionListItemResponse),
            nextCursor: result.nextCursor,
          };
        }),
      );
  }),
);
