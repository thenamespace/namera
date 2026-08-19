import type {
  ApiKeyView,
  ExecutionActivityView,
  ExecutionDetailsView,
  OAuthAuthorizationView,
  SessionKeyView,
} from "@namera-ai/application";
import type { NotificationInboxItem, WalletView } from "@namera-ai/database";
import type {
  GetInvitationResponse,
  ApiKeyResponse,
  ExecutionDetailsResponse,
  ExecutionListItemResponse,
  GetOrganizationMemberResponse,
  GetOrganizationResponse,
  GetOrganizationRoleResponse,
  GetSessionResponse,
  GetUserResponse,
  NotificationResponse,
  OAuthAuthorizationResponse,
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
    case "session_key.revoked":
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
    case "api_key.revoked":
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
    case "mcp_authorization.approved":
      return {
        notification: input.notification,
        readAt: input.recipient.readAt,
        receivedAt: input.recipient.receivedAt,
      };
    case "mcp_authorization.revoked":
      return {
        notification: input.notification,
        readAt: input.recipient.readAt,
        receivedAt: input.recipient.receivedAt,
      };
    case "cli_authorization.approved":
      return {
        notification: input.notification,
        readAt: input.recipient.readAt,
        receivedAt: input.recipient.receivedAt,
      };
    case "cli_authorization.revoked":
      return {
        notification: input.notification,
        readAt: input.recipient.readAt,
        receivedAt: input.recipient.receivedAt,
      };
  }
};

export const toOAuthAuthorizationResponse = (
  input: OAuthAuthorizationView,
): OAuthAuthorizationResponse => ({
  id: input.authorization.id,
  organizationId: input.authorization.organizationId,
  actorId: input.authorization.actorId,
  type: input.authorization.type,
  client: {
    id: input.client.id,
    clientId: input.client.clientId,
    registrationType: input.client.registrationType,
    clientName: input.client.clientName,
    clientUri: input.client.clientUri,
    logoUri: input.client.logoUri,
  },
  authorizedBy: toMemberResponse(input.authorizedBy),
  scopes: input.authorization.scopes,
  resource: input.authorization.resource,
  status: input.authorization.status,
  metadata: input.authorization.metadata,
  expiresAt: input.authorization.expiresAt,
  lastUsedAt: input.authorization.lastUsedAt,
  revokedAt: input.authorization.revokedAt,
  sessionKeys: input.sessionKeys.map(toSessionKeySummaryResponse),
  createdAt: input.authorization.createdAt,
  updatedAt: input.authorization.updatedAt,
});

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

export const toExecutionListItemResponse = (
  input: ExecutionActivityView,
): ExecutionListItemResponse => input;

export const toExecutionDetailsResponse = (
  input: ExecutionDetailsView,
): ExecutionDetailsResponse => {
  const common = {
    id: input.actor.id,
    type: input.actorDetails.type,
  } as const;
  let actor: ExecutionDetailsResponse["actor"];

  switch (input.actorDetails.type) {
    case "user":
      actor = {
        ...common,
        type: "user",
        member: toMemberResponse(input.actorDetails.member),
      };
      break;
    case "api-key": {
      const apiKey = input.actorDetails.apiKey;
      actor = {
        ...common,
        type: "api-key",
        apiKey: {
          id: apiKey.id,
          metadata: apiKey.metadata,
          keyStart: apiKey.keyStart,
          expiresAt: apiKey.expiresAt,
          lastUsedAt: apiKey.lastUsedAt,
          revokedAt: apiKey.revokedAt,
          createdAt: apiKey.createdAt,
          updatedAt: apiKey.updatedAt,
        },
      };
      break;
    }
    case "mcp":
    case "cli": {
      const authorization = input.actorDetails.authorization;
      const client = input.actorDetails.client;
      actor = {
        ...common,
        type: input.actorDetails.type,
        authorization: {
          id: authorization.id,
          client: {
            id: client.id,
            clientId: client.clientId,
            registrationType: client.registrationType,
            clientName: client.clientName,
            clientUri: client.clientUri,
            logoUri: client.logoUri,
          },
          scopes: authorization.scopes,
          resource: authorization.resource,
          status: authorization.status,
          metadata: authorization.metadata,
          expiresAt: authorization.expiresAt,
          lastUsedAt: authorization.lastUsedAt,
          revokedAt: authorization.revokedAt,
          createdAt: authorization.createdAt,
          updatedAt: authorization.updatedAt,
        },
      };
      break;
    }
  }

  return {
    execution: input.execution,
    wallet: toWalletResponse(input.wallet),
    sessionKey: toSessionKeySummaryResponse(input.sessionKey),
    actor,
  };
};

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
