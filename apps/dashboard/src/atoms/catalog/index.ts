import { Effect } from "effect";
import { Atom } from "effect/reactivity";

import type { SearchCatalogRequest } from "@namera-ai/protocol/dto";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";

import { NameraClient } from "@/atoms/client";

export type CatalogPickerSearch = {
  readonly chainIds: readonly SupportedEvmChainId[];
  readonly types: NonNullable<SearchCatalogRequest["types"]>;
  readonly query: string;
  readonly offset: number;
};

const searchFamily = Atom.family((key: string) => {
  const search = JSON.parse(key) as CatalogPickerSearch;
  return NameraClient.runtime
    .atom(
      Effect.gen(function* () {
        const client = yield* NameraClient;
        const pages = yield* Effect.all(
          search.chainIds.map((chainId) =>
            client.catalog.search({
              query: {
                namespace: "eip155",
                chainId,
                types: search.types,
                query: search.query,
                limit: 20,
                offset: search.offset,
              },
            }),
          ),
          { concurrency: 4 },
        );
        return {
          matches: pages.flatMap((page) =>
            page.entries.flatMap((catalog) => catalog.entries.map((entry) => ({ catalog, entry }))),
          ),
          hasMore: pages.some((page) => page.nextOffset !== null),
        };
      }),
    )
    .pipe(Atom.setIdleTTL("30 seconds"));
});

export const catalogPickerSearchAtom = (search: CatalogPickerSearch) =>
  searchFamily(
    JSON.stringify({
      ...search,
      chainIds: [...new Set(search.chainIds)].toSorted(),
      types: [...new Set(search.types)].toSorted(),
    }),
  );
