import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceCurrentUser, toMemberResponse, toOrganizationResponse } from "#/helpers/index";

export const OrganizationRoutes = HttpApiBuilder.group(NameraApi, "organization", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    return handlers
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          return toOrganizationResponse(
            yield* app.organization.create(actor.user.id, actor.session.id, payload.metadata),
          );
        }),
      )
      .handle("list", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          return (yield* app.organization.list(actor.user.id)).map((membership) => ({
            organization: toOrganizationResponse(membership.organization),
            organizationMember: toMemberResponse(membership),
          }));
        }),
      )
      .handle("setActive", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          yield* app.organization.setActive(
            actor.user.id,
            actor.session.id,
            payload.organizationId,
          );
        }),
      )
      .handle("getOrganization", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["organization:read"]);
          return toOrganizationResponse(
            yield* app.organization.get(actor.user.id, query.organizationId),
          );
        }),
      )
      .handle("update", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["organization:update"]);
          return toOrganizationResponse(
            yield* app.organization.update(actor.actorId, actor.organization.id, payload.metadata),
          );
        }),
      );
  }),
);
