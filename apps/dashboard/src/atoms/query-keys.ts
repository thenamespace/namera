import type { InvitationId, OrganizationId, WalletId } from "@namera-ai/protocol";

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
  invitation: {
    all: ["invitation:all"] as const,
    lists: ["invitation:lists"] as const,
    userLists: ["invitation:user-lists"] as const,
    details: ["invitation:details"] as const,
    detail: (invitationId: InvitationId) => [`invitation:detail:${invitationId}`] as const,
  },
  wallet: {
    all: ["wallet:all"] as const,
    lists: ["wallet:lists"] as const,
    list: (organizationId: OrganizationId) => [`wallet:list:${organizationId}`] as const,
    details: ["wallet:details"] as const,
    detail: (walletId: WalletId) => [`wallet:detail:${walletId}`] as const,
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
  | (typeof QueryKeys.invitation.all)[number]
  | (typeof QueryKeys.invitation.lists)[number]
  | (typeof QueryKeys.invitation.userLists)[number]
  | (typeof QueryKeys.invitation.details)[number]
  | ReturnType<typeof QueryKeys.invitation.detail>[number]
  | (typeof QueryKeys.wallet.all)[number]
  | (typeof QueryKeys.wallet.lists)[number]
  | ReturnType<typeof QueryKeys.wallet.list>[number]
  | (typeof QueryKeys.wallet.details)[number]
  | ReturnType<typeof QueryKeys.wallet.detail>[number];
