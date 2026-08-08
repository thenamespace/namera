import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { OrganizationService } from "@namera-ai/application";
import type { MemberPermission } from "@namera-ai/protocol/model";

import { enforceActor, toMemberResponse, toOrganizationResponse } from "#/helpers/index";

const actorData = (permissions: readonly MemberPermission[] = []) =>
  Effect.gen(function* () {
    const actor = yield* CurrentActor;
    return yield* enforceActor({
      actor,
      allowedActors: ["user"],
      requiredPermissions: { user: permissions },
    });
  });

export const OrganizationRoutes = HttpApiBuilder.group(NameraApi, "organization", (handlers) =>
  Effect.gen(function* () {
    const organizations = yield* OrganizationService;

    return handlers
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* actorData();
          return toOrganizationResponse(
            yield* organizations.create(actor.user.id, actor.session.id, payload.metadata),
          );
        }),
      )
      .handle("list", () =>
        Effect.gen(function* () {
          const actor = yield* actorData();
          return (yield* organizations.list(actor.user.id)).map((membership) => ({
            organization: toOrganizationResponse(membership.organization),
            organizationMember: toMemberResponse(membership),
          }));
        }),
      )
      .handle("setActive", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* actorData();
          yield* organizations.setActive(actor.user.id, actor.session.id, payload.organizationId);
        }),
      )
      .handle("getOrganization", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* actorData();
          return toOrganizationResponse(
            yield* organizations.get(actor.user.id, query.organizationId),
          );
        }),
      )
      .handle("update", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* actorData(["organization:update"]);
          return toOrganizationResponse(
            yield* organizations.update(actor.organization.id, payload.metadata),
          );
        }),
      );
  }),
);
