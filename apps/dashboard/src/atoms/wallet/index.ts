import { Effect } from "effect";
import { Atom } from "effect/reactivity";

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
  NameraClient.runtime
    .atom(
      Effect.gen(function* () {
        const client = yield* NameraClient;
        const first = yield* client.wallet.getPortfolio({
          params: { walletId },
          query: { pageSize: 100 },
        });
        const items = [...first.items];
        let cursor = first.nextCursor;
        const seen = new Set<string>();
        while (cursor !== null) {
          if (seen.has(cursor)) return yield* Effect.die(new Error("Repeated portfolio cursor"));
          seen.add(cursor);
          const page = yield* client.wallet.getPortfolio({
            params: { walletId },
            query: { pageSize: 100, cursor },
          });
          items.push(...page.items);
          cursor = page.nextCursor;
        }
        return { ...first, items, nextCursor: null };
      }),
    )
    .pipe(
      NameraClient.runtime.factory.withReactivity([
        ...QueryKeys.organization.active,
        ...QueryKeys.wallet.all,
        ...QueryKeys.wallet.assets(walletId),
      ]),
      Atom.setIdleTTL("5 minutes"),
    ),
);

export const refreshWalletPortfolioMutation = NameraClient.mutation("wallet", "getPortfolio");

export const createWalletMutation = NameraClient.mutation("wallet", "create");
export const walletPasskeyOwnerAtom = (walletId: WalletId) =>
  NameraClient.query("wallet", "getPasskeyOwner", {
    params: { walletId },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.wallet.all,
      ...QueryKeys.wallet.detail(walletId),
    ],
    timeToLive: "30 seconds",
  });
export const createPasskeyRegistrationOptionsMutation = NameraClient.mutation(
  "wallet",
  "createPasskeyRegistrationOptions",
);
