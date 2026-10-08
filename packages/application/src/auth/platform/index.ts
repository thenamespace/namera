import { DateTime, Duration, Effect, Option } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";
import { PlatformAuthError, type Email } from "@namera-ai/protocol";
import {
  platformPermissions,
  type PlatformMember,
  type PlatformInvitation,
} from "@namera-ai/protocol/model";

import { AuthConfig } from "#/auth/config";

import {
  requirePlatformPermission,
  requirePlatformSession,
  type PlatformSession,
} from "./access.js";

const safeInvitation = ({ tokenHash: _tokenHash, ...value }: PlatformInvitation) => value;

export const makePlatformApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  const transactions = yield* TransactionService;
  const crypto = yield* CryptoService;
  const emails = yield* EmailJobs;
  const config = yield* AuthConfig;
  const store = repository.auth.platform;
  const cancelDelivery = (id: string) =>
    repository.jobs.email.cancelPendingByIdempotencyKey(`platform-invitation:${id}`);

  const me = Effect.fn("application.platform.me")(
    function* (context: PlatformSession) {
      const user = yield* requirePlatformSession(repository, context);
      const member = yield* store.findMember(user.id);
      if (!member || member.status !== "active")
        return yield* new PlatformAuthError({ code: "ADMIN_ACCESS_REQUIRED" });
      return { member, email: user.email, permissions: platformPermissions[member.role] };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const members = Effect.fn("application.platform.members")(
    function* (context: PlatformSession) {
      yield* requirePlatformPermission(repository, context, "team:manage");
      return yield* store.listMembers();
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const invitations = Effect.fn("application.platform.invitations")(
    function* (context: PlatformSession, cursor?: string) {
      yield* requirePlatformPermission(repository, context, "team:manage");
      return (yield* store.listInvitations(cursor)).map(safeInvitation);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const invite = Effect.fn("application.platform.invite")(
    function* (
      context: PlatformSession,
      input: { email: Email; role: PlatformInvitation["role"] },
    ) {
      if (Option.isNone(config.adminPublicOrigin))
        return yield* new PlatformAuthError({ code: "ADMIN_ORIGIN_REQUIRED" });
      const origin = config.adminPublicOrigin.value;
      return yield* transactions.run(
        Effect.gen(function* () {
          yield* store.lockTeam();
          const actor = yield* requirePlatformPermission(repository, context, "team:manage", true);
          const user = yield* repository.auth.user.findByEmail(input.email);
          if (user && (yield* store.findMember(user.id)))
            return yield* new PlatformAuthError({ code: "MEMBER_ALREADY_EXISTS" });
          const now = yield* DateTime.now;
          for (const previous of yield* store.retireInvitations(input.email, now)) {
            yield* cancelDelivery(previous.id);
            yield* store.appendEvent(actor.id, {
              version: 1,
              type: "invitation.revoked",
              invitationId: previous.id,
            });
          }
          const token = yield* crypto.randomToken(32);
          const created = yield* store.createInvitation({
            ...input,
            invitedByMemberId: actor.id,
            createdAt: now,
            tokenHash: yield* crypto.hash({
              purpose: cryptoPurpose.platformInvitation,
              value: token,
            }),
            expiresAt: DateTime.addDuration(now, Duration.days(7)),
          });
          // Fragments do not reach HTTP access logs or Referer headers.
          const url = new URL("/invitations/accept", origin);
          url.hash = new URLSearchParams({ token }).toString();
          yield* emails.enqueue({
            type: "platform-invitation",
            to: input.email,
            idempotencyKey: `platform-invitation:${created.id}`,
            expiresAt: created.expiresAt,
            variables: {
              invitationUrl: url.toString(),
              role: created.role,
              expiresAt: DateTime.formatIso(created.expiresAt),
            },
          });
          yield* store.appendEvent(actor.id, {
            version: 1,
            type: "invitation.created",
            invitationId: created.id,
          });
          return safeInvitation(created);
        }),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const revokeInvitation = Effect.fn("application.platform.revokeInvitation")(
    function* (context: PlatformSession, id: string) {
      return yield* transactions.run(
        Effect.gen(function* () {
          yield* store.lockTeam();
          const actor = yield* requirePlatformPermission(repository, context, "team:manage", true);
          const revoked = yield* store.revokeInvitation(id, yield* DateTime.now);
          if (!revoked) return { revoked: false };
          yield* cancelDelivery(id);
          yield* store.appendEvent(actor.id, {
            version: 1,
            type: "invitation.revoked",
            invitationId: id,
          });
          return { revoked: true };
        }),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const accept = Effect.fn("application.platform.acceptInvitation")(
    function* (context: PlatformSession, token: string) {
      return yield* transactions.run(
        Effect.gen(function* () {
          yield* store.lockTeam();
          const user = yield* requirePlatformSession(repository, context, true);
          const now = yield* DateTime.now;
          const invitation = yield* store.findInvitationByHash(
            yield* crypto.hash({ purpose: cryptoPurpose.platformInvitation, value: token }),
          );
          if (
            !invitation ||
            invitation.revokedAt ||
            invitation.acceptedAt ||
            DateTime.toEpochMillis(invitation.expiresAt) <= DateTime.toEpochMillis(now)
          )
            return yield* new PlatformAuthError({ code: "INVITATION_UNAVAILABLE" });
          if (invitation.email !== user.email)
            return yield* new PlatformAuthError({ code: "INVITATION_EMAIL_MISMATCH" });
          if (yield* store.findMember(user.id))
            return yield* new PlatformAuthError({ code: "MEMBER_ALREADY_EXISTS" });
          const inviter = yield* store.findById(invitation.invitedByMemberId);
          if (!inviter || inviter.role !== "owner" || inviter.status !== "active")
            return yield* new PlatformAuthError({ code: "INVITATION_UNAVAILABLE" });
          if (!(yield* store.acceptInvitation(invitation.id, user.id, now)))
            return yield* new PlatformAuthError({ code: "INVITATION_UNAVAILABLE" });
          const member = yield* store.createMember({ userId: user.id, role: invitation.role });
          yield* cancelDelivery(invitation.id);
          yield* store.appendEvent(member.id, {
            version: 1,
            type: "invitation.accepted",
            invitationId: invitation.id,
          });
          return member;
        }),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const changeMember = Effect.fn("application.platform.changeMember")(
    function* (
      context: PlatformSession,
      id: string,
      change: { role?: "operator" | "viewer"; status?: PlatformMember["status"] },
    ) {
      return yield* transactions.run(
        Effect.gen(function* () {
          yield* store.lockTeam();
          const actor = yield* requirePlatformPermission(repository, context, "team:manage", true);
          const target = yield* store.findById(id);
          if (!target) return yield* new PlatformAuthError({ code: "MEMBER_NOT_FOUND" });
          if (target.role === "owner")
            return yield* new PlatformAuthError({ code: "OWNER_TRANSFER_REQUIRED" });
          if (
            (!change.role || change.role === target.role) &&
            (!change.status || change.status === target.status)
          )
            return target;
          const changed = yield* store.changeMember(id, change, yield* DateTime.now);
          if (!changed) return yield* new PlatformAuthError({ code: "MEMBER_NOT_FOUND" });
          yield* store.appendEvent(actor.id, {
            version: 1,
            type: "member.changed",
            memberId: id,
            role: changed.role,
            status: changed.status,
          });
          return changed;
        }),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const transfer = Effect.fn("application.platform.transferOwnership")(
    function* (context: PlatformSession, memberId: string) {
      return yield* transactions.run(
        Effect.gen(function* () {
          yield* store.lockTeam();
          const actor = yield* requirePlatformPermission(
            repository,
            context,
            "ownership:transfer",
            true,
          );
          const target = yield* store.findById(memberId);
          if (!target || target.status !== "active" || target.id === actor.id)
            return yield* new PlatformAuthError({ code: "MEMBER_NOT_FOUND" });
          const now = yield* DateTime.now;
          yield* store.changeMember(actor.id, { role: "operator" }, now);
          yield* store.changeMember(target.id, { role: "owner" }, now);
          yield* store.appendEvent(actor.id, {
            version: 1,
            type: "ownership.transferred",
            previousOwnerId: actor.id,
            newOwnerId: target.id,
          });
        }),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { me, members, invitations, invite, revokeInvitation, accept, changeMember, transfer };
});
