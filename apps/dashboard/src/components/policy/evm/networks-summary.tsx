import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";

import { ChainDisplay } from "@/components/display/chain-display";

export function NetworksSummary({ chainIds }: { chainIds: readonly SupportedEvmChainId[] }) {
  if (!chainIds.length) return <span>Choose at least one network.</span>;
  const remaining = chainIds.length - 2;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4">
      {chainIds.slice(0, 2).map((chainId) => (
        <ChainDisplay key={chainId} chainId={chainId} size="sm" />
      ))}
      {remaining > 0 ? (
        <span>
          and {remaining} other {remaining === 1 ? "network" : "networks"}
        </span>
      ) : null}
    </div>
  );
}
