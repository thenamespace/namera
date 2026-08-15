import type { ApiKeyView, SessionKeyView } from "@namera-ai/application";
import type { NotificationInboxItem, WalletView } from "@namera-ai/database";
import type {
  GetInvitationResponse,
  ApiKeyResponse,
  GetOrganizationMemberResponse,
  GetOrganizationResponse,
  GetOrganizationRoleResponse,
  GetSessionResponse,
  GetUserResponse,
  NotificationResponse,
  SessionKeyResponse,
  SessionKeySummaryResponse,
  WalletResponse,
} from "@namera-ai/protocol/dto";
import type {
  Invitation,
  Organization,
  OrganizationMember,
  OrganizationRole,
  Session,
  SessionKey,
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
    case "wallet.created":
      return {
        notification: input.notification,
        readAt: input.recipient.readAt,
        receivedAt: input.recipient.receivedAt,
      };
    case "session_key.created":
      return {
        notification: input.notification,
        readAt: input.recipient.readAt,
        receivedAt: input.recipient.receivedAt,
      };
    case "api_key.created":
      return {
        notification: input.notification,
        readAt: input.recipient.readAt,
        receivedAt: input.recipient.receivedAt,
      };
    case "execution.confirmed":
      return {
        notification: input.notification,
        readAt: input.recipient.readAt,
        receivedAt: input.recipient.receivedAt,
      };
  }
};

export const toApiKeyResponse = (input: ApiKeyView): ApiKeyResponse => ({
  id: input.apiKey.id,
  organizationId: input.apiKey.organizationId,
  actorId: input.apiKey.actorId,
  metadata: input.apiKey.metadata,
  keyStart: input.apiKey.keyStart,
  expiresAt: input.apiKey.expiresAt,
  lastUsedAt: input.apiKey.lastUsedAt,
  revokedAt: input.apiKey.revokedAt,
  createdAt: input.apiKey.createdAt,
  updatedAt: input.apiKey.updatedAt,
  sessionKeys: input.sessionKeys.map(toSessionKeySummaryResponse),
  creator: toMemberResponse(input.creator),
});

export const toSessionKeySummaryResponse = (sessionKey: SessionKey): SessionKeySummaryResponse => ({
  id: sessionKey.id,
  organizationId: sessionKey.organizationId,
  walletId: sessionKey.walletId,
  namespace: sessionKey.namespace,
  metadata: sessionKey.metadata,
  policies: sessionKey.policies,
  policyHash: sessionKey.policyHash,
  status: sessionKey.status,
  revokedAt: sessionKey.revokedAt,
  createdAt: sessionKey.createdAt,
});

export const toSessionKeyResponse = (input: SessionKeyView): SessionKeyResponse => ({
  ...toSessionKeySummaryResponse(input.sessionKey),
  wallet: toWalletResponse(input.wallet),
  creator: toMemberResponse(input.creator),
});

export const toWalletResponse = (input: WalletView): WalletResponse => {
  const common = {
    id: input.wallet.id,
    organizationId: input.wallet.organizationId,
    metadata: input.wallet.metadata,
    status: input.wallet.status,
    namespace: input.wallet.namespace,
    address: input.wallet.data.address,
    protectionLevel: input.walletKey.protectionLevel,
    createdAt: input.wallet.createdAt,
    updatedAt: input.wallet.updatedAt,
  } as const;

  if (input.wallet.data.implementation === "kernel") {
    return {
      ...common,
      implementation: "kernel",
      data: {
        version: input.wallet.data.version,
        kernelVersion: input.wallet.data.kernelVersion,
        validatorType: input.wallet.data.validatorType,
        entryPointVersion: input.wallet.data.entryPointVersion,
        accountIndex: input.wallet.data.accountIndex,
      },
    };
  }

  return {
    ...common,
    implementation: "safe",
    data: {
      version: input.wallet.data.version,
      safeVersion: input.wallet.data.safeVersion,
      validatorType: input.wallet.data.validatorType,
      entryPointVersion: input.wallet.data.entryPointVersion,
      saltNonce: input.wallet.data.saltNonce,
    },
  };
};
