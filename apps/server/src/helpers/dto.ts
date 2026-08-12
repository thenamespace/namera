import type { NotificationInboxItem } from "@namera-ai/database";
import type {
  GetInvitationResponse,
  GetOrganizationMemberResponse,
  GetOrganizationResponse,
  GetOrganizationRoleResponse,
  GetSessionResponse,
  GetUserResponse,
  NotificationResponse,
} from "@namera-ai/protocol/dto";
import type {
  Invitation,
  Organization,
  OrganizationMember,
  OrganizationRole,
  Session,
  User,
} from "@namera-ai/protocol/model";

export const toUserResponse = (user: User): GetUserResponse => ({
  id: user.id,
  email: user.email,
  emailVerified: user.emailVerified,
  metadata: user.metadata,
  lastLoginAt: user.lastLoginAt,
});

export const toSessionResponse = (session: Session): GetSessionResponse => ({
  id: session.id,
  userId: session.userId,
  activeOrganizationId: session.activeOrganizationId,
  ipAddress: session.ipAddress,
  userAgent: session.userAgent,
  createdAt: session.createdAt,
  expiresAt: session.expiresAt,
  revokedAt: session.revokedAt,
});

export const toOrganizationResponse = (organization: Organization): GetOrganizationResponse => ({
  id: organization.id,
  plan: organization.plan,
  metadata: organization.metadata,
});

export const toRoleResponse = (role: OrganizationRole): GetOrganizationRoleResponse =>
  role.type === "system"
    ? {
        id: role.id,
        key: role.key,
        metadata: role.metadata,
        type: role.type,
        permissions: role.permissions,
        systemRoleId: role.systemRoleId,
      }
    : {
        id: role.id,
        key: role.key,
        metadata: role.metadata,
        type: role.type,
        permissions: role.permissions,
        systemRoleId: role.systemRoleId,
      };

export const toMemberResponse = (input: {
  organizationMember: OrganizationMember;
  organizationRole: OrganizationRole;
  user: User;
}): GetOrganizationMemberResponse => ({
  organizationMember: {
    id: input.organizationMember.id,
    userId: input.organizationMember.userId,
    organizationId: input.organizationMember.organizationId,
    organizationRoleId: input.organizationMember.organizationRoleId,
    joinedAt: input.organizationMember.joinedAt,
  },
  user: toUserResponse(input.user),
  organizationRole: toRoleResponse(input.organizationRole),
});

export const toInvitationResponse = (input: {
  invitation: Invitation;
  organization: Organization;
  organizationRole: OrganizationRole;
  inviter: User;
}): GetInvitationResponse => ({
  invitation: {
    id: input.invitation.id,
    email: input.invitation.email,
    inviterId: input.invitation.inviterId,
    organizationId: input.invitation.organizationId,
    organizationRoleId: input.invitation.organizationRoleId,
    status: input.invitation.status,
    expiresAt: input.invitation.expiresAt,
  },
  inviter: toUserResponse(input.inviter),
  organization: toOrganizationResponse(input.organization),
  organizationRole: toRoleResponse(input.organizationRole),
});

export const toNotificationResponse = (input: NotificationInboxItem): NotificationResponse => {
  switch (input.notification.type) {
    case "auth.new-sign-in":
      return {
        notification: input.notification,
        readAt: input.recipient.readAt,
        receivedAt: input.recipient.receivedAt,
      };
    case "organization.invitation.received":
      return {
        notification: input.notification,
        readAt: input.recipient.readAt,
        receivedAt: input.recipient.receivedAt,
      };
  }
};
