import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import { Avatar, Typography, type DataGridColumn } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";

import {
  formatBalance,
  formatUnitPrice,
  formatUsd,
  getAssetName,
  getAssetSymbol,
  type AssetTableRow,
} from "./data";

export type AssetGridRow = AssetTableRow;

export const getAssetRowId = (row: AssetGridRow): string => row.id;

function TokenIcon({ asset, symbol }: { asset: AssetTableRow; symbol: string }) {
  const chain = getChainDataByCaip2(asset.chainId);
  return (
    <span className="relative mr-1 inline-flex size-9 shrink-0">
      <Avatar className="size-9" size="sm">
        {asset.metadata.logoUrl === null ? null : (
          <Avatar.Image alt="" src={asset.metadata.logoUrl} />
        )}
        <Avatar.Fallback>
          {asset.type === "native" && symbol === "ETH" ? (
            <ChainIcon aria-hidden chain="ethereum" namespace="eip155" className="size-7" />
          ) : (
            symbol.slice(0, 2).toUpperCase()
          )}
        </Avatar.Fallback>
      </Avatar>
      <span className="absolute -right-1 -bottom-1 grid size-4.5 place-items-center rounded-full bg-surface ring-2 ring-surface">
        <ChainIcon
          aria-hidden
          chain={chain?.name ?? "ethereum"}
          namespace="eip155"
          className="size-3.5"
        />
      </span>
    </span>
  );
}

function TokenDisplay({ asset }: { asset: AssetTableRow }) {
  const symbol = getAssetSymbol(asset);
  return (
    <div className="flex min-w-0 items-center gap-3 py-1">
      <TokenIcon asset={asset} symbol={symbol} />
      <div className="min-w-0 leading-tight">
        <Typography className="truncate text-sm!" weight="medium">
          {symbol}
        </Typography>
        <Typography className="truncate text-xs! leading-tight" color="muted">
          {getChainDataByCaip2(asset.chainId)?.chain.name ?? asset.chainId}
        </Typography>
      </div>
    </div>
  );
}

export const assetColumns: Array<DataGridColumn<AssetGridRow>> = [
  {
    allowsSorting: true,
    cell: (row) => <TokenDisplay asset={row} />,
    header: "Token",
    id: "asset",
    isRowHeader: true,
    minWidth: 220,
    pinned: "start",
    width: "1fr",
  },
  {
    align: "end",
    allowsSorting: true,
    cell: (row) => (
      <span className="text-sm tabular-nums">{formatBalance(row.formattedBalance)}</span>
    ),
    header: "Balance",
    id: "balance",
    minWidth: 120,
    width: 170,
  },
  {
    align: "end",
    allowsSorting: true,
    cell: (row) => (
      <span className="text-sm tabular-nums text-muted">{formatUnitPrice(row.priceUsd)}</span>
    ),
    header: "Price (USD)",
    id: "price",
    minWidth: 110,
    width: 150,
  },
  {
    align: "end",
    allowsSorting: true,
    cell: (row) =>
      row.numericValueUsd === null ? (
        <span className="text-sm text-muted">—</span>
      ) : (
        <span className="text-sm font-medium tabular-nums">{formatUsd(row.numericValueUsd)}</span>
      ),
    header: "Value (USD)",
    id: "value",
    minWidth: 120,
    width: 170,
  },
];

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const nullableNumber = (value: number | null): number => value ?? Number.NEGATIVE_INFINITY;

export const assetSorters: Readonly<
  Record<string, (left: AssetTableRow, right: AssetTableRow) => number>
> = {
  asset: (left, right) => collator.compare(getAssetName(left), getAssetName(right)),
  balance: (left, right) =>
    Number(left.formattedBalance ?? 0) - Number(right.formattedBalance ?? 0),
  price: (left, right) => nullableNumber(left.priceUsd) - nullableNumber(right.priceUsd),
  value: (left, right) =>
    nullableNumber(left.numericValueUsd) - nullableNumber(right.numericValueUsd),
};
