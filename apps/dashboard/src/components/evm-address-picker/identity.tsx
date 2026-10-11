import { chains } from "@namera-ai/evm/chains";
import { Avatar } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";

import type { EvmAddressSelection } from "./types";

export function AddressIdentity({ value }: { value: EvmAddressSelection }) {
  const network = Object.values(chains).find((chain) => chain.chainId === value.chainId);
  const metadata = value.source === "catalog" ? value.match.catalog.data : null;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
      <span className="relative shrink-0">
        <Avatar size="sm">
          {metadata ? (
            <Avatar.Image src={`https://cdn.namera.ai/${metadata.display.logo}`} alt="" />
          ) : null}
          <Avatar.Fallback>
            {metadata ? metadata.display.name.slice(0, 2).toUpperCase() : "0x"}
          </Avatar.Fallback>
        </Avatar>
        {network ? (
          <ChainIcon
            aria-hidden
            namespace="eip155"
            chain={network.name}
            className="bg-surface absolute -right-1 -bottom-1 size-4 rounded-full ring-2 ring-surface"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">
            {metadata?.display.name ?? "Custom address"}
          </span>
          {metadata?.type === "erc20" ? (
            <span className="text-muted text-xs">{metadata.details.symbol}</span>
          ) : null}
        </span>
        <span className="text-muted block truncate text-xs">
          {network?.chain.name ?? value.chainId} ·{" "}
          <span className="font-mono" title={value.address}>
            {value.address.slice(0, 6)}…{value.address.slice(-4)}
          </span>
        </span>
      </span>
    </span>
  );
}
