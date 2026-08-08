import { Context, DateTime, Effect, Layer } from "effect";

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
import type {
  Invitation,
  Organization,
  OrganizationMember,
  OrganizationMetadata,
  OrganizationRole,
  User,
} from "@namera-ai/protocol/model";

import { AuthConfig } from "#/auth/config";

import { createOrganizationWithOwner, requireActiveOrganization } from "./helpers.js";

export interface MembershipView {
  readonly organizationMember: OrganizationMember;
  readonly organization: Organization;
  readonly organizationRole: OrganizationRole;
  readonly user: User;
}

export interface MemberView {
  readonly organizationMember: OrganizationMember;
  readonly organizationRole: OrganizationRole;
  readonly user: User;
}

export interface InvitationView {
  readonly invitation: Invitation;
  readonly organization: Organization;
  readonly organizationRole: OrganizationRole;
  readonly inviter: User;
}

export interface OrganizationServiceValue {
  readonly create: (
    userId: UserId,
    sessionId: SessionId,
    metadata: OrganizationMetadata,
  ) => Effect.Effect<Organization, OrganizationError>;
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<MembershipView>>;
  readonly get: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<Organization, OrganizationError>;
  readonly setActive: (
    userId: UserId,
    sessionId: SessionId,
    organizationId: OrganizationId,
  ) => Effect.Effect<void, OrganizationError>;
  readonly update: (
    organizationId: OrganizationId,
    metadata: OrganizationMetadata,
  ) => Effect.Effect<Organization, OrganizationError>;
  readonly listMembers: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<MemberView>>;
  readonly getInvitation: (
    invitationId: InvitationId,
    email: Email,
  ) => Effect.Effect<InvitationView, InvitationError>;
  readonly listInvitations: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<InvitationView>>;
  readonly listUserInvitations: (email: Email) => Effect.Effect<ReadonlyArray<InvitationView>>;
  readonly inviteMember: (input: {
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

const invitationNotFound = () => new InvitationError({ code: "INVITATION_NOT_FOUND" });

export class OrganizationService extends Context.Service<
  OrganizationService,
  OrganizationServiceValue
>()("@namera-ai/application/OrganizationService") {
  static readonly layer = Layer.effect(
    OrganizationService,
    Effect.gen(function* () {
      const config = yield* AuthConfig;
      const repository = yield* Repository;
      const transaction = yield* TransactionService;

      const create = Effect.fn("OrganizationService.create")(
        function* (userId: UserId, sessionId: SessionId, metadata: OrganizationMetadata) {
          const now = yield* DateTime.now;
          const organization = yield* transaction.run(
            Effect.gen(function* () {
              const created = yield* createOrganizationWithOwner(repository, userId, metadata.name);
              if (metadata.logo !== undefined || metadata.description !== undefined) {
                yield* repository.auth.organization.update(created.id, metadata);
              }
              yield* repository.auth.session.setActiveOrganization(
                sessionId,
                userId,
                created.id,
                now,
              );
              return { ...created, metadata };
            }),
          );
          yield* Effect.logInfo("organization.created");
          return organization;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const list = Effect.fn("OrganizationService.list")(
        function* (userId: UserId) {
          return yield* repository.auth.member.findMembershipsForUser(userId);
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const get = Effect.fn("OrganizationService.get")(
        function* (userId: UserId, organizationId: OrganizationId) {
          const membership = yield* repository.auth.member.findActiveMembership(
            userId,
            organizationId,
          );
          return (yield* requireActiveOrganization(membership)).organization;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const setActive = Effect.fn("OrganizationService.setActive")(
        function* (userId: UserId, sessionId: SessionId, organizationId: OrganizationId) {
          const updated = yield* repository.auth.session.setActiveOrganization(
            sessionId,
            userId,
            organizationId,
            yield* DateTime.now,
          );
          if (!updated) return yield* new OrganizationError({ code: "ORGANIZATION_NOT_FOUND" });
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const update = Effect.fn("OrganizationService.update")(
        function* (organizationId: OrganizationId, metadata: OrganizationMetadata) {
          return yield* repository.auth.organization
            .update(organizationId, metadata)
            .pipe(Effect.flatMap(requireActiveOrganization));
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const listMembers = Effect.fn("OrganizationService.listMembers")(
        function* (organizationId: OrganizationId) {
          return yield* repository.auth.member.findOrganizationMembersForOrg(organizationId);
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const getInvitation = Effect.fn("OrganizationService.getInvitation")(
        function* (invitationId: InvitationId, email: Email) {
          const invitation = yield* repository.auth.invitation.findByIdForEmail(
            invitationId,
            email,
          );
          return yield* invitation ? Effect.succeed(invitation) : Effect.fail(invitationNotFound());
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const listInvitations = Effect.fn("OrganizationService.listInvitations")(
        function* (organizationId: OrganizationId) {
          return yield* repository.auth.invitation.findPendingForOrgId(
            organizationId,
            yield* DateTime.now,
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const listUserInvitations = Effect.fn("OrganizationService.listUserInvitations")(
        function* (email: Email) {
          return yield* repository.auth.invitation.findPendingForEmail(email, yield* DateTime.now);
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const inviteMember = Effect.fn("OrganizationService.inviteMember")(
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
          if (!invitation) return yield* invitationNotFound();
          yield* Effect.logInfo("invitation.created");
          return invitation;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const acceptInvitation = Effect.fn("OrganizationService.acceptInvitation")(
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
              if (!found) return yield* invitationNotFound();
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
              if (!accepted) return yield* invitationNotFound();
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

      const rejectInvitation = Effect.fn("OrganizationService.rejectInvitation")(
        function* (invitationId: InvitationId, email: Email) {
          const rejected = yield* repository.auth.invitation.rejectPending(
            invitationId,
            email,
            yield* DateTime.now,
          );
          if (!rejected) return yield* invitationNotFound();
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const cancelInvitation = Effect.fn("OrganizationService.cancelInvitation")(
        function* (invitationId: InvitationId, organizationId: OrganizationId) {
          const canceled = yield* repository.auth.invitation.cancelPending(
            invitationId,
            organizationId,
          );
          if (!canceled) return yield* invitationNotFound();
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      return OrganizationService.of({
        create,
        list,
        get,
        setActive,
        update,
        listMembers,
        getInvitation,
        listInvitations,
        listUserInvitations,
        inviteMember,
        acceptInvitation,
        rejectInvitation,
        cancelInvitation,
      });
    }),
  );
}
