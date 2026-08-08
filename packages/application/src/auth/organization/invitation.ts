import { DateTime, Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import {
  InvitationError,
  OrganizationError,
  type Email,
  type InvitationId,
  type OrganizationId,
  type OrganizationRoleId,
  type SessionId,
  type UserId,
} from "@namera-ai/protocol";
import type { Invitation, Organization, OrganizationRole, User } from "@namera-ai/protocol/model";

import { AuthConfig } from "#/auth/config";

export interface InvitationView {
  readonly invitation: Invitation;
  readonly organization: Organization;
  readonly organizationRole: OrganizationRole;
  readonly inviter: User;
}

export interface InvitationApplication {
  readonly getInvitation: (
    invitationId: InvitationId,
    email: Email,
  ) => Effect.Effect<InvitationView, InvitationError>;
  readonly listInvitations: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<InvitationView>>;
  readonly listUserInvitations: (email: Email) => Effect.Effect<ReadonlyArray<InvitationView>>;
  readonly createInvitation: (input: {
    email: Email;
    inviterId: UserId;
    organizationId: OrganizationId;
    organizationRoleId: OrganizationRoleId;
  }) => Effect.Effect<InvitationView, InvitationError | OrganizationError>;
  readonly acceptInvitation: (input: {
    invitationId: InvitationId;
    email: Email;
    userId: UserId;
    sessionId: SessionId;
  }) => Effect.Effect<void, InvitationError>;
  readonly rejectInvitation: (
    invitationId: InvitationId,
    email: Email,
  ) => Effect.Effect<void, InvitationError>;
  readonly cancelInvitation: (
    invitationId: InvitationId,
    organizationId: OrganizationId,
  ) => Effect.Effect<void, InvitationError>;
}

export const makeInvitationApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const getInvitation = Effect.fn("Application.organization.invitation.getInvitation")(
    function* (invitationId: InvitationId, email: Email) {
      const invitation = yield* repository.auth.invitation.findByIdForEmail(invitationId, email);
      if (!invitation) {
        return yield* new InvitationError({ code: "INVITATION_NOT_FOUND" });
      }
      return invitation;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const listInvitations = Effect.fn("Application.organization.invitation.listInvitations")(
    function* (organizationId: OrganizationId) {
      return yield* repository.auth.invitation.findPendingForOrgId(
        organizationId,
        yield* DateTime.now,
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const listUserInvitations = Effect.fn("Application.organization.invitation.listUserInvitations")(
    function* (email: Email) {
      return yield* repository.auth.invitation.findPendingForEmail(email, yield* DateTime.now);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const createInvitation = Effect.fn("Application.organization.invitation.createInvitation")(
    function* (input: {
      email: Email;
      inviterId: UserId;
      organizationId: OrganizationId;
      organizationRoleId: OrganizationRoleId;
    }) {
      const now = yield* DateTime.now;
      const role = yield* repository.auth.role.findById(
        input.organizationId,
        input.organizationRoleId,
      );
      if (!role) return yield* new OrganizationError({ code: "ORGANIZATION_NOT_FOUND" });

      const existingUser = yield* repository.auth.user.findByEmail(input.email);
      if (existingUser) {
        const member = yield* repository.auth.member.findActiveMembership(
          existingUser.id,
          input.organizationId,
        );
        if (member) return yield* new InvitationError({ code: "ALREADY_A_MEMBER" });
      }

      const existingInvitation = (yield* repository.auth.invitation.findPendingForOrgId(
        input.organizationId,
        now,
      )).find((item) => item.invitation.email === input.email);
      if (existingInvitation) return existingInvitation;

      const invitation = yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.auth.invitation.expirePendingForEmail(
            input.organizationId,
            input.email,
            now,
          );
          const created = yield* repository.auth.invitation.insert({
            ...input,
            expiresAt: DateTime.addDuration(now, config.invitation.timeToLive),
          });
          return yield* repository.auth.invitation.findById(created.id, input.organizationId);
        }),
      );
      if (!invitation) {
        return yield* new InvitationError({ code: "INVITATION_NOT_FOUND" });
      }
      yield* Effect.logInfo("invitation.created");
      return invitation;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const acceptInvitation = Effect.fn("Application.organization.invitation.acceptInvitation")(
    function* (input: {
      invitationId: InvitationId;
      email: Email;
      userId: UserId;
      sessionId: SessionId;
    }) {
      const now = yield* DateTime.now;
      yield* transaction.run(
        Effect.gen(function* () {
          const found = yield* repository.auth.invitation.findByIdForEmail(
            input.invitationId,
            input.email,
          );
          if (!found) {
            return yield* new InvitationError({ code: "INVITATION_NOT_FOUND" });
          }
          const member = yield* repository.auth.member.findActiveMembership(
            input.userId,
            found.invitation.organizationId,
          );
          if (member) return yield* new InvitationError({ code: "ALREADY_A_MEMBER" });

          const accepted = yield* repository.auth.invitation.acceptPending(
            input.invitationId,
            input.email,
            now,
          );
          if (!accepted) {
            return yield* new InvitationError({ code: "INVITATION_NOT_FOUND" });
          }
          yield* repository.auth.member.insert({
            userId: input.userId,
            organizationId: accepted.organizationId,
            organizationRoleId: accepted.organizationRoleId,
          });
          yield* repository.auth.session.setActiveOrganization(
            input.sessionId,
            input.userId,
            accepted.organizationId,
            now,
          );
        }),
      );
      yield* Effect.logInfo("invitation.accepted");
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const rejectInvitation = Effect.fn("Application.organization.invitation.rejectInvitation")(
    function* (invitationId: InvitationId, email: Email) {
      const rejected = yield* repository.auth.invitation.rejectPending(
        invitationId,
        email,
        yield* DateTime.now,
      );
      if (!rejected) {
        return yield* new InvitationError({ code: "INVITATION_NOT_FOUND" });
      }
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const cancelInvitation = Effect.fn("Application.organization.invitation.cancelInvitation")(
    function* (invitationId: InvitationId, organizationId: OrganizationId) {
      const canceled = yield* repository.auth.invitation.cancelPending(
        invitationId,
        organizationId,
      );
      if (!canceled) {
        return yield* new InvitationError({ code: "INVITATION_NOT_FOUND" });
      }
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return {
    getInvitation,
    listInvitations,
    listUserInvitations,
    createInvitation,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
  } satisfies InvitationApplication;
});
