import type {
  ApiKeyId,
  InvitationId,
  OrganizationId,
  OAuthAuthorizationRequestId,
  OAuthDeviceAuthorizationId,
  SessionKeyId,
  WalletId,
} from "@namera-ai/protocol";

export const QueryKeys = {
  session: {
    current: ["session:current"] as const,
    lists: ["session:lists"] as const,
  },
  organization: {
    all: ["organization:all"] as const,
    active: ["organization:active"] as const,
    lists: ["organization:lists"] as const,
    details: ["organization:details"] as const,
    detail: (organizationId: OrganizationId) => [`organization:detail:${organizationId}`] as const,
  },
  member: {
    lists: ["member:lists"] as const,
  },
  role: {
    lists: ["role:lists"] as const,
    assignable: ["role:assignable"] as const,
  },
  invitation: {
    all: ["invitation:all"] as const,
    lists: ["invitation:lists"] as const,
    userLists: ["invitation:user-lists"] as const,
    details: ["invitation:details"] as const,
    detail: (invitationId: InvitationId) => [`invitation:detail:${invitationId}`] as const,
  },
  notification: {
    all: ["notification:all"] as const,
    lists: ["notification:lists"] as const,
    unreadCount: ["notification:unread-count"] as const,
    preferences: ["notification:preferences"] as const,
  },
  wallet: {
    all: ["wallet:all"] as const,
    lists: ["wallet:lists"] as const,
    details: ["wallet:details"] as const,
    detail: (walletId: WalletId) => [`wallet:detail:${walletId}`] as const,
  },
  sessionKey: {
    all: ["session-key:all"] as const,
    lists: ["session-key:lists"] as const,
    organizationLists: ["session-key:organization-lists"] as const,
    walletLists: ["session-key:wallet-lists"] as const,
    walletList: (walletId: WalletId) => [`session-key:wallet-list:${walletId}`] as const,
    details: ["session-key:details"] as const,
    detail: (sessionKeyId: SessionKeyId) => [`session-key:detail:${sessionKeyId}`] as const,
  },
  apiKey: {
    all: ["api-key:all"] as const,
    lists: ["api-key:lists"] as const,
    details: ["api-key:details"] as const,
    detail: (apiKeyId: ApiKeyId) => [`api-key:detail:${apiKeyId}`] as const,
  },
  oauth: {
    authorizationRequests: ["oauth:authorization-requests"] as const,
    authorizationRequest: (requestId: OAuthAuthorizationRequestId) =>
      [`oauth:authorization-request:${requestId}`] as const,
    deviceAuthorizations: ["oauth:device-authorizations"] as const,
    deviceAuthorization: (authorizationId: OAuthDeviceAuthorizationId) =>
      [`oauth:device-authorization:${authorizationId}`] as const,
  },
} as const;

export type QueryKey =
  | (typeof QueryKeys.session.current)[number]
  | (typeof QueryKeys.session.lists)[number]
  | (typeof QueryKeys.organization.all)[number]
  | (typeof QueryKeys.organization.active)[number]
  | (typeof QueryKeys.organization.lists)[number]
  | (typeof QueryKeys.organization.details)[number]
  | ReturnType<typeof QueryKeys.organization.detail>[number]
  | (typeof QueryKeys.member.lists)[number]
  | (typeof QueryKeys.role.lists)[number]
  | (typeof QueryKeys.role.assignable)[number]
  | (typeof QueryKeys.invitation.all)[number]
  | (typeof QueryKeys.invitation.lists)[number]
  | (typeof QueryKeys.invitation.userLists)[number]
  | (typeof QueryKeys.invitation.details)[number]
  | ReturnType<typeof QueryKeys.invitation.detail>[number]
  | (typeof QueryKeys.notification.all)[number]
  | (typeof QueryKeys.notification.lists)[number]
  | (typeof QueryKeys.notification.unreadCount)[number]
  | (typeof QueryKeys.notification.preferences)[number]
  | (typeof QueryKeys.wallet.all)[number]
  | (typeof QueryKeys.wallet.lists)[number]
  | (typeof QueryKeys.wallet.details)[number]
  | ReturnType<typeof QueryKeys.wallet.detail>[number]
  | (typeof QueryKeys.sessionKey.all)[number]
  | (typeof QueryKeys.sessionKey.lists)[number]
  | (typeof QueryKeys.sessionKey.organizationLists)[number]
  | (typeof QueryKeys.sessionKey.walletLists)[number]
  | ReturnType<typeof QueryKeys.sessionKey.walletList>[number]
  | (typeof QueryKeys.sessionKey.details)[number]
  | ReturnType<typeof QueryKeys.sessionKey.detail>[number]
  | (typeof QueryKeys.apiKey.all)[number]
  | (typeof QueryKeys.apiKey.lists)[number]
  | (typeof QueryKeys.apiKey.details)[number]
  | ReturnType<typeof QueryKeys.apiKey.detail>[number]
  | (typeof QueryKeys.oauth.authorizationRequests)[number]
  | ReturnType<typeof QueryKeys.oauth.authorizationRequest>[number]
  | (typeof QueryKeys.oauth.deviceAuthorizations)[number]
  | ReturnType<typeof QueryKeys.oauth.deviceAuthorization>[number];
