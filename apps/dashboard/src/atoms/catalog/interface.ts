import { Effect } from "effect";
import { Atom } from "effect/reactivity";

import type { ContractInterfaceId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";

export const catalogInterfaceAtom = Atom.family((interfaceId: ContractInterfaceId | null) =>
  NameraClient.runtime
    .atom(
      Effect.gen(function* () {
        if (!interfaceId) return null;
        const client = yield* NameraClient;
        return yield* client.catalog.getInterface({ params: { interfaceId } });
      }),
    )
    .pipe(Atom.setIdleTTL("5 minutes")),
);
