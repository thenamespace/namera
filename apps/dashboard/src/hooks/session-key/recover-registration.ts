import { useCallback, useContext } from "react";

import { RegistryContext } from "@effect/atom-react";

import type { WalletId } from "@namera-ai/protocol";

import { prefetchQuery } from "@/atoms/prefetch";
import { walletSessionKeysAtom } from "@/atoms/session-key";

/** Refresh rather than reuse the list cached before a possibly committed create. */
export function useRecoverSessionRegistration() {
  const registry = useContext(RegistryContext);
  return useCallback(
    async (walletId: WalletId, signal: AbortSignal) => {
      const atom = walletSessionKeysAtom(walletId);
      registry.refresh(atom);
      return prefetchQuery(registry, atom, signal);
    },
    [registry],
  );
}
