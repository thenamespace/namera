import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceCurrentUser, toInvitationResponse } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

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
          yield* consumeRateLimit(
            "invitation.create.organization",
            actor.organization.id,
            rateLimitPolicy.invitation.createByOrganization,
          );
          yield* consumeRateLimit(
            "invitation.create.recipient",
            payload.email,
            rateLimitPolicy.invitation.createByRecipient,
          );
          return toInvitationResponse(
            yield* invitations.createInvitation({
              ...payload,
              actorId: actor.actorId,
              inviterId: actor.user.id,
              organizationId: actor.organization.id,
              inviterPermissions: actor.role.permissions,
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
          yield* invitations.rejectInvitation(
            payload.invitationId,
            actor.user.email,
            actor.user.id,
          );
        }),
      )
      .handle("cancelInvitation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser(["invitation:cancel"]);
          yield* invitations.cancelInvitation(
            payload.invitationId,
            actor.organization.id,
            actor.actorId,
          );
        }),
      );
  }),
);
