import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type { CatalogAddress } from "@namera-ai/protocol/dto";
import { Avatar, Skeleton } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";

import { useCatalogAddress } from "@/hooks/catalog";

import { getAssetSymbol, type AssetTableRow } from "./data";

function TokenAvatar({
  logoUrl,
  symbol,
  native,
  chainId,
}: {
  logoUrl: string | null;
  symbol: string;
  native: boolean;
  chainId: CatalogAddress["chainId"];
}) {
  const nativeLogo =
    native && getChainDataByCaip2(chainId)?.name === "arc"
      ? "https://cdn.namera.ai/address-catalog/eip155/erc20/usdc.png"
      : null;
  const imageUrl = logoUrl ?? nativeLogo;

  return (
    <Avatar size="sm" className="size-8">
      {imageUrl ? <Avatar.Image alt="" src={imageUrl} /> : null}
      <Avatar.Fallback>
        {native && symbol === "ETH" ? (
          <ChainIcon aria-hidden chain="ethereum" namespace="eip155" className="size-8" />
        ) : (
          symbol.slice(0, 2).toUpperCase()
        )}
      </Avatar.Fallback>
    </Avatar>
  );
}

function CatalogTokenAvatar({ symbol, ...address }: CatalogAddress & { symbol: string }) {
  const query = useCatalogAddress(address);
  if (query.isPending)
    return <Skeleton className="size-8 rounded-full" aria-label="Loading token logo" />;
  const metadata = query.data?.catalog.data;
  return (
    <TokenAvatar
      logoUrl={metadata?.type === "erc20" ? `https://cdn.namera.ai/${metadata.display.logo}` : null}
      symbol={symbol}
      native={false}
      chainId={address.chainId}
    />
  );
}

export function AssetTokenDisplay({ asset }: { asset: AssetTableRow }) {
  const symbol = getAssetSymbol(asset);
  const chain = getChainDataByCaip2(asset.chainId);
  const chainName = chain?.chain.name ?? asset.chainId;
  return (
    <span
      className="flex min-w-0 items-center gap-3 py-1"
      title={`${asset.metadata.name ?? symbol} · ${chainName}${asset.tokenAddress ? ` · ${asset.tokenAddress}` : ""}`}
    >
      <span className="relative shrink-0">
        {asset.metadata.logoUrl === null && asset.type === "erc20" && asset.tokenAddress ? (
          <CatalogTokenAvatar
            namespace={asset.namespace}
            chainId={asset.chainId}
            address={asset.tokenAddress}
            symbol={symbol}
          />
        ) : (
          <TokenAvatar
            logoUrl={asset.metadata.logoUrl}
            symbol={symbol}
            native={asset.type === "native"}
            chainId={asset.chainId}
          />
        )}
        {chain ? (
          <ChainIcon
            aria-hidden
            chain={chain.name}
            namespace="eip155"
            className="bg-surface absolute -right-0.5 -bottom-1 size-3 rounded-full ring-1 ring-surface"
          />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{symbol}</span>
        <span className="truncate text-xs text-muted">{chainName}</span>
      </span>
    </span>
  );
}
