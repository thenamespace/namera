import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceCurrentUser, toInvitationResponse } from "#/helpers/index";

export const InvitationRoutes = HttpApiBuilder.group(NameraApi, "invitation", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    const invitations = app.organization.invitation;

    return handlers
      .handle("getInvitation", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          return toInvitationResponse(
            yield* invitations.getInvitation(query.invitationId, actor.user.email),
          );
        }),
      )
      .handle("listInvitations", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["invitation:read"]);
          return (yield* invitations.listInvitations(actor.organization.id)).map(
            toInvitationResponse,
          );
        }),
      )
      .handle("listUserInvitations", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          return (yield* invitations.listUserInvitations(actor.user.email)).map(
            toInvitationResponse,
          );
        }),
      )
      .handle("inviteMember", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["invitation:create"]);
          return toInvitationResponse(
            yield* invitations.createInvitation({
              ...payload,
              inviterId: actor.user.id,
              organizationId: actor.organization.id,
            }),
          );
        }),
      )
      .handle("acceptInvitation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          yield* invitations.acceptInvitation({
            invitationId: payload.invitationId,
            email: actor.user.email,
            userId: actor.user.id,
            sessionId: actor.session.id,
          });
        }),
      )
      .handle("rejectInvitation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          yield* invitations.rejectInvitation(payload.invitationId, actor.user.email);
        }),
      )
      .handle("cancelInvitation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["invitation:cancel"]);
          yield* invitations.cancelInvitation(payload.invitationId, actor.organization.id);
        }),
      );
  }),
);
