import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type { CatalogAddress } from "@namera-ai/protocol/dto";
import { Avatar, Button, Skeleton, Tooltip } from "@namera-ai/ui";
import { ChainIcon, Coins01Icon, HugeiconsIcon, InformationCircleIcon } from "@namera-ai/ui/icons";

import { useCatalogAddress } from "@/hooks/catalog";

import { tokenDisplayDetails } from "./token-details";

export function TokenDisplay({
  amount,
  size = "md",
  ...address
}: CatalogAddress & { readonly amount?: string; readonly size?: "sm" | "md" }) {
  const query = useCatalogAddress(address);
  const token = tokenDisplayDetails(query.data, amount);
  const network = getChainDataByCaip2(address.chainId);
  const shortAddress = `${address.address.slice(0, 6)}…${address.address.slice(-4)}`;

  if (query.isPending)
    return (
      <output
        className={size === "sm" ? "flex h-4 items-center gap-1" : "flex h-9 items-center gap-2"}
        aria-label="Loading token"
      >
        <Skeleton className={size === "sm" ? "size-3 rounded-full" : "size-6 rounded-full"} />
        <Skeleton className={size === "sm" ? "h-3 w-20 rounded" : "h-4 w-32 rounded"} />
      </output>
    );

  return (
    <span
      className={
        size === "sm"
          ? "flex min-w-0 items-center gap-1 text-[11px] leading-4"
          : "flex min-w-0 items-center gap-2 py-1"
      }
      title={`${address.address} · ${network?.chain.name ?? address.chainId}`}
    >
      <span className="relative shrink-0">
        {token ? (
          <Avatar className={size === "sm" ? "size-3" : "size-6"}>
            <Avatar.Image src={`https://cdn.namera.ai/${token.display.logo}`} alt="" />
            <Avatar.Fallback>{token.symbol.slice(0, 2)}</Avatar.Fallback>
          </Avatar>
        ) : (
          <span
            className={`bg-default grid place-items-center rounded-full ${size === "sm" ? "size-3" : "size-6"}`}
          >
            <HugeiconsIcon
              icon={Coins01Icon}
              className={size === "sm" ? "size-2.5" : "size-4"}
              aria-hidden
            />
          </span>
        )}
        {network ? (
          <ChainIcon
            namespace={address.namespace}
            chain={network.name}
            aria-hidden
            className={`bg-surface absolute -right-0.5 -bottom-0.5 rounded-full ring-1 ring-surface ${size === "sm" ? "size-1.5" : "size-2.5"}`}
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
      <Tooltip delay={300}>
        <Tooltip.Trigger
          aria-label={`Token address ${address.address}`}
          className="text-muted shrink-0"
        >
          <HugeiconsIcon
            icon={InformationCircleIcon}
            className={size === "sm" ? "size-3" : "size-3.5"}
            aria-hidden
          />
        </Tooltip.Trigger>
        <Tooltip.Content className="max-w-none whitespace-nowrap font-mono text-xs" showArrow>
          <Tooltip.Arrow />
          {address.address}
        </Tooltip.Content>
      </Tooltip>
      {query.isError ? (
        <Button size="sm" variant="ghost" onPress={query.refetch} aria-label="Retry token metadata">
          Retry
        </Button>
      ) : null}
    </span>
  );
}
