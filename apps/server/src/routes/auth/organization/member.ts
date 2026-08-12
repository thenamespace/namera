import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceCurrentUser, toMemberResponse } from "#/helpers/index";

export const MemberRoutes = HttpApiBuilder.group(NameraApi, "member", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    return handlers
      .handle("listOrgMembers", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["member:read"]);
          return (yield* app.organization.member.listMembers(actor.organization.id)).map(
            toMemberResponse,
          );
        }),
      )
      .handle("updateMemberRole", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["member:update"]);
          return toMemberResponse(
            yield* app.organization.member.updateRole({
              ...payload,
              actorId: actor.actorId,
              actorPermissions: actor.role.permissions,
              organizationId: actor.organization.id,
            }),
          );
        }),
      )
      .handle("removeMember", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["member:remove"]);
          yield* app.organization.member.remove({
            ...payload,
            actorId: actor.actorId,
            actorPermissions: actor.role.permissions,
            organizationId: actor.organization.id,
          });
        }),
      );
  }),
);
