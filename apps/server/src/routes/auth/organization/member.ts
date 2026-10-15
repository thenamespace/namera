import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor, requireDashboardOrigin, toMemberResponse } from "#/helpers/index";

export const MemberRoutes = HttpApiBuilder.group(NameraApi, "member", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    const config = yield* Application.AuthConfig;
    return handlers
      .handle("listOrgMembers", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["member:read"] },
          });
          return (yield* app.organization.member.listMembers(data.organization.id)).map(
            toMemberResponse,
          );
        }),
      )
      .handle("listOrgRoles", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["role:read"] },
          });
          return yield* app.organization.member.listRoles(data.organization.id);
        }),
      )
      .handle("listAssignableRoles", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["role:read"] },
          });
          return yield* app.organization.member.listAssignableRoles(
            data.organization.id,
            data.role,
          );
        }),
      )
      .handle("updateMemberRole", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["member:update"] },
          });
          yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          return toMemberResponse(
            yield* app.organization.member.updateRole({
              ...payload,
              actorId: data.actorId,
              actorRole: data.role,
              organizationId: data.organization.id,
            }),
          );
        }),
      )
      .handle("removeMember", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["member:remove"] },
          });
          yield* requireDashboardOrigin(config.dashboardPublicOrigin.origin);
          yield* app.organization.member.remove({
            ...payload,
            actorId: data.actorId,
            actorRole: data.role,
            organizationId: data.organization.id,
          });
        }),
      );
  }),
);
