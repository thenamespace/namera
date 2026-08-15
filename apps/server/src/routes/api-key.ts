import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor, toApiKeyResponse } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const ApiKeyRoutes = HttpApiBuilder.group(NameraApi, "apiKey", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["api-key:create"] },
          });
          yield* consumeRateLimit(
            "api_key.create.organization",
            data.organization.id,
            rateLimitPolicy.apiKey.createByOrganization,
          );
          const created = yield* app.apiKey.create({
            organizationId: data.organization.id,
            actorId: data.actorId,
            request: payload,
          });
          return {
            apiKey: toApiKeyResponse(created.apiKey),
            key: created.key,
          };
        }),
      )
      .handle("list", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["api-key:read"] },
          });
          return (yield* app.apiKey.list(data.organization.id)).map(toApiKeyResponse);
        }),
      )
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["api-key:read"] },
          });
          return toApiKeyResponse(yield* app.apiKey.get(data.organization.id, params.apiKeyId));
        }),
      )
      .handle("revoke", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["api-key:revoke"] },
          });
          yield* consumeRateLimit(
            "api_key.revoke.organization",
            data.organization.id,
            rateLimitPolicy.apiKey.revokeByOrganization,
          );
          return toApiKeyResponse(
            yield* app.apiKey.revoke({
              organizationId: data.organization.id,
              actorId: data.actorId,
              apiKeyId: params.apiKeyId,
            }),
          );
        }),
      );
  }),
);
