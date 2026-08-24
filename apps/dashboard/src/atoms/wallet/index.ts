import { Atom } from "effect/unstable/reactivity";

import type { WalletId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const walletsAtom = NameraClient.query("wallet", "list", {
  reactivityKeys: [
    ...QueryKeys.organization.active,
    ...QueryKeys.wallet.all,
    ...QueryKeys.wallet.lists,
  ],
  timeToLive: "30 seconds",
});

export const walletAtom = (walletId: WalletId) =>
  NameraClient.query("wallet", "get", {
    params: { walletId },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.wallet.all,
      ...QueryKeys.wallet.details,
      ...QueryKeys.wallet.detail(walletId),
    ],
    timeToLive: "30 seconds",
  });

export const walletPortfolioAtom = Atom.family((walletId: WalletId) =>
  NameraClient.query("wallet", "getPortfolio", {
    params: { walletId },
    query: { pageSize: 100 },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.wallet.all,
      ...QueryKeys.wallet.assets(walletId),
    ],
    timeToLive: "30 seconds",
  }),
);

export const createWalletMutation = NameraClient.mutation("wallet", "create");
