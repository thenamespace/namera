import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";
import {
  InvitationError,
  OrganizationError,
  type ActorId,
  type Email,
  type InvitationId,
  type OrganizationId,
  type OrganizationRoleId,
  type SessionId,
  type UserId,
} from "@namera-ai/protocol";
import type { Invitation, Organization, OrganizationRole, User } from "@namera-ai/protocol/model";
import type { MemberPermission } from "@namera-ai/protocol/model";
import { organizationInvitationEvents, sessionLifecycleEvents } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { createUserOrganizationMember } from "#/auth/organization/helpers";
import { makeCreateNotification } from "#/notification/create";

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
    actorId: ActorId;
    inviterId: UserId;
    organizationId: OrganizationId;
    organizationRoleId: OrganizationRoleId;
    inviterPermissions: ReadonlyArray<MemberPermission>;
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
    userId: UserId,
  ) => Effect.Effect<void, InvitationError>;
  readonly cancelInvitation: (
    invitationId: InvitationId,
    organizationId: OrganizationId,
    actorId: ActorId,
  ) => Effect.Effect<void, InvitationError>;
}

export const makeInvitationApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const audit = yield* Audit;
  const emailJobs = yield* EmailJobs;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const createNotification = yield* makeCreateNotification;

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
      actorId: ActorId;
      inviterId: UserId;
      organizationId: OrganizationId;
      organizationRoleId: OrganizationRoleId;
      inviterPermissions: ReadonlyArray<MemberPermission>;
    }) {
      const now = yield* DateTime.now;
      const role = yield* repository.auth.role.findById(
        input.organizationId,
        input.organizationRoleId,
      );
      if (!role) return yield* new OrganizationError({ code: "ORGANIZATION_NOT_FOUND" });
      if (!role.permissions.every((permission) => input.inviterPermissions.includes(permission))) {
        return yield* new OrganizationError({ code: "INSUFFICIENT_PERMISSIONS" });
      }

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
            email: input.email,
            inviterId: input.inviterId,
            organizationId: input.organizationId,
            organizationRoleId: input.organizationRoleId,
            expiresAt: DateTime.addDuration(now, config.invitation.timeToLive),
          });
          const createdEvent = yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "invitation.created",
            resourceType: "invitation",
            resourceId: created.id,
            data: { version: 1 },
          });
          const view = yield* repository.auth.invitation.findById(created.id, input.organizationId);
          if (!view) {
            return yield* new InvitationError({ code: "INVITATION_NOT_FOUND" });
          }
          const email = {
            type: "organization-invitation" as const,
            to: input.email,
            variables: {
              invitationUrl: new URL(
                `/invitations/${created.id}`,
                config.dashboardPublicOrigin,
              ).toString(),
              organizationName: view.organization.metadata.name,
              inviterName: view.inviter.metadata.name ?? view.inviter.email,
              roleName: view.organizationRole.metadata.name,
              expiresAt: DateTime.formatIso(created.expiresAt),
            },
            expiresAt: created.expiresAt,
          };
          if (existingUser) {
            yield* createNotification({
              organizationId: input.organizationId,
              actorId: input.actorId,
              type: "organization.invitation.received",
              resourceType: "invitation",
              resourceId: created.id,
              data: { version: 1 },
              idempotencyKey: `notification:organization.invitation:${created.id}`,
              correlationId: createdEvent.correlationId,
              expiresAt: created.expiresAt,
              recipients: [{ userId: existingUser.id, email }],
            });
          } else {
            yield* emailJobs.enqueue({
              ...email,
              idempotencyKey: `organization-invitation:${created.id}`,
            });
          }
          return view;
        }),
      );
      yield* Metric.update(organizationInvitationEvents, "created");
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
          const createdMember = yield* createUserOrganizationMember(repository, audit, {
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
          yield* audit.organization({
            organizationId: accepted.organizationId,
            actorId: createdMember.actorId,
            event: "invitation.accepted",
            resourceType: "invitation",
            resourceId: accepted.id,
            data: {
              version: 1,
              organizationMemberId: createdMember.id,
            },
          });
          yield* audit.user({
            userId: input.userId,
            sessionId: input.sessionId,
            event: "session.active_organization_changed",
            data: { version: 1, organizationId: accepted.organizationId },
          });
          yield* repository.notification.inbox.expireByResource({
            type: "organization.invitation.received",
            resourceId: accepted.id,
            expiresAt: now,
          });
          yield* repository.jobs.email.cancelPendingByIdempotencyKey(
            `notification:organization.invitation:${accepted.id}:${input.userId}:email`,
          );
        }),
      );
      yield* Metric.update(organizationInvitationEvents, "accepted");
      yield* Metric.update(sessionLifecycleEvents, "active_organization_changed");
      yield* Effect.logInfo("invitation.accepted");
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const rejectInvitation = Effect.fn("Application.organization.invitation.rejectInvitation")(
    function* (invitationId: InvitationId, email: Email, userId: UserId) {
      const now = yield* DateTime.now;
      const rejected = yield* transaction.run(
        Effect.gen(function* () {
          const invitation = yield* repository.auth.invitation.rejectPending(
            invitationId,
            email,
            now,
          );
          if (!invitation) return undefined;
          yield* audit.organization({
            organizationId: invitation.organizationId,
            actorId: null,
            event: "invitation.rejected",
            resourceType: "invitation",
            resourceId: invitation.id,
            data: { version: 1, userId },
          });
          yield* repository.notification.inbox.expireByResource({
            type: "organization.invitation.received",
            resourceId: invitation.id,
            expiresAt: now,
          });
          yield* repository.jobs.email.cancelPendingByIdempotencyKey(
            `notification:organization.invitation:${invitation.id}:${userId}:email`,
          );
          return invitation;
        }),
      );
      if (!rejected) {
        return yield* new InvitationError({ code: "INVITATION_NOT_FOUND" });
      }
      yield* Metric.update(organizationInvitationEvents, "rejected");
      yield* Effect.logInfo("invitation.rejected");
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const cancelInvitation = Effect.fn("Application.organization.invitation.cancelInvitation")(
    function* (invitationId: InvitationId, organizationId: OrganizationId, actorId: ActorId) {
      const now = yield* DateTime.now;
      const canceled = yield* transaction.run(
        Effect.gen(function* () {
          const invitation = yield* repository.auth.invitation.cancelPending(
            invitationId,
            organizationId,
          );
          if (!invitation) return undefined;
          yield* audit.organization({
            organizationId,
            actorId,
            event: "invitation.canceled",
            resourceType: "invitation",
            resourceId: invitation.id,
            data: { version: 1 },
          });
          yield* repository.notification.inbox.expireByResource({
            type: "organization.invitation.received",
            resourceId: invitation.id,
            expiresAt: now,
          });
          const recipient = yield* repository.auth.user.findByEmail(invitation.email);
          yield* repository.jobs.email.cancelPendingByIdempotencyKey(
            recipient === undefined
              ? `organization-invitation:${invitation.id}`
              : `notification:organization.invitation:${invitation.id}:${recipient.id}:email`,
          );
          return invitation;
        }),
      );
      if (!canceled) {
        return yield* new InvitationError({ code: "INVITATION_NOT_FOUND" });
      }
      yield* Metric.update(organizationInvitationEvents, "canceled");
      yield* Effect.logInfo("invitation.canceled");
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
