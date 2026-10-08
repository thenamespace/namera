import { Schema } from "effect";

import { Email, UserId } from "#/common/index";

import { UserMetadata } from "./core/user.js";

export const PlatformRole = Schema.Literals(["owner", "operator", "viewer"]);
export type PlatformRole = typeof PlatformRole.Type;
export const PlatformAssignableRole = Schema.Literals(["operator", "viewer"]);
export const PlatformMemberStatus = Schema.Literals(["active", "suspended", "removed"]);
export const PlatformPermission = Schema.Literals([
  "team:manage",
  "ownership:transfer",
  "invites:read",
  "invites:manage",
  "waitlist:read",
  "waitlist:accept",
]);
export type PlatformPermission = typeof PlatformPermission.Type;

export const platformPermissions: Readonly<Record<PlatformRole, readonly PlatformPermission[]>> = {
  owner: [
    "team:manage",
    "ownership:transfer",
    "invites:read",
    "invites:manage",
    "waitlist:read",
    "waitlist:accept",
  ],
  operator: ["invites:read", "invites:manage", "waitlist:read", "waitlist:accept"],
  viewer: ["invites:read", "waitlist:read"],
};

export const PlatformMember = Schema.Struct({
  id: Schema.String,
  userId: UserId,
  role: PlatformRole,
  status: PlatformMemberStatus,
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
});
export type PlatformMember = typeof PlatformMember.Type;
export const PlatformMemberView = Schema.Struct({
  ...PlatformMember.fields,
  email: Email,
  metadata: UserMetadata,
});

export const PlatformInvitation = Schema.Struct({
  id: Schema.String,
  email: Email,
  role: PlatformAssignableRole,
  tokenHash: Schema.String,
  invitedByMemberId: Schema.String,
  expiresAt: Schema.DateTimeUtcFromDate,
  acceptedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  acceptedByUserId: Schema.NullOr(UserId),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  createdAt: Schema.DateTimeUtcFromDate,
});
export type PlatformInvitation = typeof PlatformInvitation.Type;

export const PlatformEventData = Schema.Union([
  Schema.Struct({
    version: Schema.Literal(1),
    type: Schema.Literal("waitlist.accepted"),
    waitlistId: Schema.String,
    inviteId: Schema.String,
  }),
  Schema.Struct({
    version: Schema.Literal(1),
    type: Schema.Literals(["beta-invite.created", "beta-invite.revoked"]),
    inviteId: Schema.String,
  }),
  Schema.Struct({
    version: Schema.Literal(1),
    type: Schema.Literal("waitlist.status-changed"),
    waitlistId: Schema.String,
    status: Schema.Literals(["pending", "completed"]),
  }),
  Schema.Struct({
    version: Schema.Literal(1),
    type: Schema.Literal("owner.bootstrapped"),
    memberId: Schema.String,
  }),
  Schema.Struct({
    version: Schema.Literal(1),
    type: Schema.Literal("member.changed"),
    memberId: Schema.String,
    role: PlatformRole,
    status: PlatformMemberStatus,
  }),
  Schema.Struct({
    version: Schema.Literal(1),
    type: Schema.Literal("ownership.transferred"),
    previousOwnerId: Schema.String,
    newOwnerId: Schema.String,
  }),
  Schema.Struct({
    version: Schema.Literal(1),
    type: Schema.Literals(["invitation.created", "invitation.revoked", "invitation.accepted"]),
    invitationId: Schema.String,
  }),
]);
export type PlatformEventData = typeof PlatformEventData.Type;
