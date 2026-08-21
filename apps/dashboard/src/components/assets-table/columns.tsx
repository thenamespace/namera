import { Avatar, Typography, type DataGridColumn } from "@namera-ai/ui";
import { ChainIcon, CheckmarkCircle02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

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
  const logoUrl = asset.addressMetadata?.identity.iconUrl ?? asset.metadata.logoUrl;

  if (asset.type === "native" && symbol === "ETH") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-tertiary">
        <ChainIcon aria-hidden chain="ethereum" className="size-5" namespace="eip155" />
      </span>
    );
  }

  return (
    <Avatar className="shrink-0" size="sm">
      {logoUrl === null ? null : <Avatar.Image alt="" src={logoUrl} />}
      <Avatar.Fallback>{symbol.slice(0, 2).toUpperCase()}</Avatar.Fallback>
    </Avatar>
  );
}

function TokenDisplay({ asset }: { asset: AssetTableRow }) {
  const symbol = getAssetSymbol(asset);
  const isVerified = asset.addressMetadata?.trust.isSourceVerified === true;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <TokenIcon asset={asset} symbol={symbol} />
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1">
          <Typography className="truncate text-sm!" weight="medium">
            {getAssetName(asset)}
          </Typography>
          {isVerified ? (
            <HugeiconsIcon
              aria-label="Source verified"
              className="size-3.5 shrink-0 text-accent"
              icon={CheckmarkCircle02Icon}
            />
          ) : null}
        </div>
        <Typography className="truncate text-xs! leading-tight" color="muted">
          {symbol}
        </Typography>
      </div>
    </div>
  );
}

export const assetColumns: Array<DataGridColumn<AssetGridRow>> = [
  {
    allowsSorting: true,
    cell: (row) => <TokenDisplay asset={row} />,
    header: "Asset",
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
    header: "Price",
    id: "price",
    minWidth: 110,
    width: 150,
  },
  {
    align: "end",
    allowsSorting: true,
    cell: (row) =>
      row.valueUsd === null ? (
        <span className="text-sm text-muted">—</span>
      ) : (
        <span className="text-sm font-medium tabular-nums">{formatUsd(row.valueUsd)}</span>
      ),
    header: "Value",
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
  value: (left, right) => nullableNumber(left.valueUsd) - nullableNumber(right.valueUsd),
};
