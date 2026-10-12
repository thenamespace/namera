import { Effect } from "effect";
import { Atom } from "effect/reactivity";

import type { CatalogAddress } from "@namera-ai/protocol/dto";

import { NameraClient } from "@/atoms/client";

const resolveFamily = Atom.family((key: string) => {
  const address = JSON.parse(key) as CatalogAddress;
  return NameraClient.runtime
    .atom(
      Effect.gen(function* () {
        const client = yield* NameraClient;
        const results = yield* client.catalog.resolve({ payload: { addresses: [address] } });
        return results[0]?.match ?? null;
      }),
    )
    .pipe(Atom.setIdleTTL("5 minutes"));
});

export const catalogAddressAtom = ({ namespace, chainId, address }: CatalogAddress) =>
  resolveFamily(JSON.stringify({ namespace, chainId, address: address.toLowerCase() }));
