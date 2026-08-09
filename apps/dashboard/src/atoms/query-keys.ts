import type { OrganizationId, WalletId } from "@namera-ai/protocol";

export const QueryKeys = {
  session: {
    current: ["session:current"] as const,
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
  | (typeof QueryKeys.wallet.all)[number]
  | (typeof QueryKeys.wallet.lists)[number]
  | ReturnType<typeof QueryKeys.wallet.list>[number]
  | (typeof QueryKeys.wallet.details)[number]
  | ReturnType<typeof QueryKeys.wallet.detail>[number];
