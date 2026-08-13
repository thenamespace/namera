import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor, toMemberResponse, toOrganizationResponse } from "#/helpers/index";

export const OrganizationRoutes = HttpApiBuilder.group(NameraApi, "organization", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    return handlers
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          return toOrganizationResponse(
            yield* app.organization.create(data.user.id, data.session.id, payload.metadata),
          );
        }),
      )
      .handle("list", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          return (yield* app.organization.list(data.user.id)).map((membership) => ({
            organization: toOrganizationResponse(membership.organization),
            organizationMember: toMemberResponse(membership),
          }));
        }),
      )
      .handle("setActive", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          yield* app.organization.setActive(data.user.id, data.session.id, payload.organizationId);
        }),
      )
      .handle("getOrganization", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["organization:read"] },
          });
          return toOrganizationResponse(
            yield* app.organization.get(data.user.id, query.organizationId),
          );
        }),
      )
      .handle("update", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["organization:update"] },
          });
          return toOrganizationResponse(
            yield* app.organization.update(data.actorId, data.organization.id, payload.metadata),
          );
        }),
      );
  }),
);
