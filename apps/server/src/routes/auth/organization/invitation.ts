import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor, toInvitationResponse } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const InvitationRoutes = HttpApiBuilder.group(NameraApi, "invitation", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    const invitations = app.organization.invitation;

    return handlers
      .handle("getInvitation", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          return toInvitationResponse(
            yield* invitations.getInvitation(query.invitationId, data.user.email),
          );
        }),
      )
      .handle("listInvitations", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["invitation:read"] },
          });
          return (yield* invitations.listInvitations(data.organization.id)).map(
            toInvitationResponse,
          );
        }),
      )
      .handle("listUserInvitations", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          return (yield* invitations.listUserInvitations(data.user.email)).map(
            toInvitationResponse,
          );
        }),
      )
      .handle("inviteMember", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["invitation:create"] },
          });
          yield* consumeRateLimit(
            "invitation.create.organization",
            data.organization.id,
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
              actorId: data.actorId,
              inviterId: data.user.id,
              organizationId: data.organization.id,
              inviterRole: data.role,
            }),
          );
        }),
      )
      .handle("acceptInvitation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          yield* invitations.acceptInvitation({
            invitationId: payload.invitationId,
            email: data.user.email,
            userId: data.user.id,
            sessionId: data.session.id,
          });
        }),
      )
      .handle("rejectInvitation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          yield* invitations.rejectInvitation(payload.invitationId, data.user.email, data.user.id);
        }),
      )
      .handle("cancelInvitation", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({
            actor,
            allowedActors: ["user"],
            requiredPermissions: { user: ["invitation:cancel"] },
          });
          yield* invitations.cancelInvitation(
            payload.invitationId,
            data.organization.id,
            data.actorId,
          );
        }),
      );
  }),
);
