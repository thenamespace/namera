import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";
import type { MemberPermission } from "@namera-ai/protocol/model";

import { enforceActor, toInvitationResponse } from "#/helpers/index";

const actorData = (permissions: readonly MemberPermission[] = []) =>
  Effect.gen(function* () {
    const actor = yield* CurrentActor;
    return yield* enforceActor({
      actor,
      allowedActors: ["user"],
      requiredPermissions: { user: permissions },
    });
  });

export const InvitationRoutes = HttpApiBuilder.group(NameraApi, "invitation", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    const organizations = app.organization;

    return handlers
      .handle("getInvitation", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* actorData();
          return toInvitationResponse(
            yield* organizations.getInvitation(query.invitationId, actor.user.email),
          );
        }),
      )
      .handle("listInvitations", () =>
        Effect.gen(function* () {
          const actor = yield* actorData(["invitation:read"]);
          return (yield* organizations.listInvitations(actor.organization.id)).map(
            toInvitationResponse,
          );
        }),
      )
      .handle("listUserInvitations", () =>
        Effect.gen(function* () {
          const actor = yield* actorData();
          return (yield* organizations.listUserInvitations(actor.user.email)).map(
            toInvitationResponse,
          );
        }),
      )
      .handle("inviteMember", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* actorData(["invitation:create"]);
          return toInvitationResponse(
            yield* organizations.inviteMember({
              ...payload,
              inviterId: actor.user.id,
              organizationId: actor.organization.id,
            }),
          );
        }),
      )
      .handle("acceptInvitation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* actorData();
          yield* organizations.acceptInvitation({
            invitationId: payload.invitationId,
            email: actor.user.email,
            userId: actor.user.id,
            sessionId: actor.session.id,
          });
        }),
      )
      .handle("rejectInvitation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* actorData();
          yield* organizations.rejectInvitation(payload.invitationId, actor.user.email);
        }),
      )
      .handle("cancelInvitation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* actorData(["invitation:cancel"]);
          yield* organizations.cancelInvitation(payload.invitationId, actor.organization.id);
        }),
      );
  }),
);
