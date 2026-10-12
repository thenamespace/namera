import { chains, type ChainData } from "@namera-ai/evm/chains";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Typography } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";

const chainDataById = new Map<SupportedEvmChainId, ChainData>(
  Object.values(chains).map((chain) => [chain.chainId, chain]),
);

type ChainDisplayProps = {
  chainId: SupportedEvmChainId;
  size?: "sm" | "md";
};

export function ChainDisplay({ chainId, size = "md" }: ChainDisplayProps) {
  const chain = chainDataById.get(chainId);
  const textClassName = size === "sm" ? "truncate text-[11px]! leading-4!" : "truncate text-sm!";

  if (chain === undefined) {
    return <Typography className={textClassName}>{chainId}</Typography>;
  }

  return (
    <div className={`flex min-w-0 items-center ${size === "sm" ? "gap-1" : "gap-2"}`}>
      <ChainIcon
        aria-hidden
        chain={chain.name}
        className={size === "sm" ? "size-3 shrink-0" : "size-4 shrink-0"}
        namespace={chain.namespace}
      />
      <Typography className={textClassName} weight="normal">
        {chain.chain.name}
      </Typography>
    </div>
  );
}

export { chainDataById };
export type { ChainDisplayProps };
