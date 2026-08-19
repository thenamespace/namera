import { chains, type ChainData } from "@namera-ai/evm";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Typography } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";

const chainDataById = new Map<SupportedEvmChainId, ChainData>(
  Object.values(chains).map((chain) => [chain.chainId, chain]),
);

type ChainDisplayProps = {
  chainId: SupportedEvmChainId;
};

export function ChainDisplay({ chainId }: ChainDisplayProps) {
  const chain = chainDataById.get(chainId);

  if (chain === undefined) {
    return <Typography className="truncate text-sm!">{chainId}</Typography>;
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ChainIcon
        aria-hidden
        chain={chain.name}
        className="size-4 shrink-0"
        namespace={chain.namespace}
      />
      <Typography className="truncate text-sm!" weight="normal">
        {chain.chain.name}
      </Typography>
    </div>
  );
}

export { chainDataById };
export type { ChainDisplayProps };
