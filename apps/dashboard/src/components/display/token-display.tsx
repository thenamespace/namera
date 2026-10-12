import { chains } from "@namera-ai/evm/chains";
import type { CatalogAddress } from "@namera-ai/protocol/dto";
import { Avatar, Button, Skeleton } from "@namera-ai/ui";
import { ChainIcon, Coins01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { useCatalogAddress } from "@/hooks/catalog";

import { tokenDisplayDetails } from "./token-details";

export function TokenDisplay({
  amount,
  ...address
}: CatalogAddress & { readonly amount?: string }) {
  const query = useCatalogAddress(address);
  const token = tokenDisplayDetails(query.data, amount);
  const network = Object.values(chains).find((chain) => chain.chainId === address.chainId);
  const shortAddress = `${address.address.slice(0, 6)}…${address.address.slice(-4)}`;

  if (query.isPending)
    return (
      <output className="flex h-9 items-center gap-2" aria-label="Loading token">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-32 rounded" />
      </output>
    );

  return (
    <span
      className="flex min-w-0 items-center gap-2 py-1"
      title={`${address.address} · ${network?.chain.name ?? address.chainId}`}
    >
      <span className="relative shrink-0">
        {token ? (
          <Avatar className="size-6">
            <Avatar.Image src={`https://cdn.namera.ai/${token.display.logo}`} alt="" />
            <Avatar.Fallback>{token.symbol.slice(0, 2)}</Avatar.Fallback>
          </Avatar>
        ) : (
          <span className="bg-default grid size-6 place-items-center rounded-full">
            <HugeiconsIcon icon={Coins01Icon} className="size-4" aria-hidden />
          </span>
        )}
        {network ? (
          <ChainIcon
            namespace={address.namespace}
            chain={network.name}
            aria-hidden
            className="bg-surface absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-1 ring-surface"
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="text-foreground block truncate font-medium">
          {token?.label ?? shortAddress}
        </span>
        {!token && amount !== undefined ? (
          <span className="text-muted block text-xs">{amount} base units</span>
        ) : null}
        <span className="sr-only">{network?.chain.name ?? address.chainId}</span>
      </span>
      {query.isError ? (
        <Button size="sm" variant="ghost" onPress={query.refetch} aria-label="Retry token metadata">
          Retry
        </Button>
      ) : null}
    </span>
  );
}
