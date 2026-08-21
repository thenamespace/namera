import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";

import type { WalletId } from "@namera-ai/protocol";
import type { ListWalletAssetsResponse } from "@namera-ai/protocol/dto";

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

export const walletAssetsAtom = Atom.family((walletId: WalletId) =>
  NameraClient.runtime
    .atom(
      Effect.gen(function* () {
        const client = yield* NameraClient;
        const items: ListWalletAssetsResponse["items"][number][] = [];
        const failures = new Map<
          ListWalletAssetsResponse["partialFailures"][number]["chainId"],
          ListWalletAssetsResponse["partialFailures"][number]
        >();
        let cursor: ListWalletAssetsResponse["nextCursor"] = null;

        do {
          const page: ListWalletAssetsResponse = yield* client.wallet.listAssets({
            params: { walletId },
            query: cursor === null ? {} : { cursor },
          });
          items.push(...page.items);
          for (const failure of page.partialFailures) failures.set(failure.chainId, failure);
          cursor = page.nextCursor;
        } while (cursor !== null);

        return {
          items,
          nextCursor: null,
          partialFailures: [...failures.values()],
        } satisfies ListWalletAssetsResponse;
      }),
    )
    .pipe(
      NameraClient.runtime.factory.withReactivity([
        ...QueryKeys.organization.active,
        ...QueryKeys.wallet.all,
        ...QueryKeys.wallet.assets(walletId),
      ]),
      Atom.setIdleTTL("30 seconds"),
    ),
);

export const createWalletMutation = NameraClient.mutation("wallet", "create");
