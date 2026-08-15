import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor, toSessionKeyResponse } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const SessionKeyRoutes = HttpApiBuilder.group(NameraApi, "sessionKey", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["session-key:create"] },
          });
          return toSessionKeyResponse(
            yield* app.sessionKey.create({
              organizationId: data.organization.id,
              actorId: data.actorId,
              request: payload,
            }),
          );
        }),
      )
      .handle("listForOrganization", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["session-key:read"] },
          });
          return (yield* app.sessionKey.listForOrganization(data.organization.id)).map(
            toSessionKeyResponse,
          );
        }),
      )
      .handle("listForWallet", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["session-key:read"] },
          });
          return (yield* app.sessionKey.listForWallet(data.organization.id, params.walletId)).map(
            toSessionKeyResponse,
          );
        }),
      )
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["session-key:read"] },
          });
          return toSessionKeyResponse(
            yield* app.sessionKey.get(data.organization.id, params.sessionKeyId),
          );
        }),
      )
      .handle("revoke", ({ params }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["session-key:revoke"] },
          });
          yield* consumeRateLimit(
            "session_key.revoke.organization",
            data.organization.id,
            rateLimitPolicy.sessionKey.revokeByOrganization,
          );
          return toSessionKeyResponse(
            yield* app.sessionKey.revoke({
              organizationId: data.organization.id,
              actorId: data.actorId,
              sessionKeyId: params.sessionKeyId,
            }),
          );
        }),
      );
  }),
);
