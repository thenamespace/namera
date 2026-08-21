import { Avatar, Typography, type DataGridColumn } from "@namera-ai/ui";
import { CheckmarkCircle02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import type { TableOption } from "@/components/common/table";
import { ChainDisplay } from "@/components/display";

import { AssetActions } from "./actions";
import {
  formatBalance,
  formatUnitPrice,
  formatUsd,
  getAssetName,
  getAssetSymbol,
  type AssetTableRow,
} from "./data";

export const assetColumnIds = [
  "balance",
  "price",
  "value",
  "chain",
  "trust",
  "type",
  "contract",
] as const;
export const assetGroupingOptions = [
  { id: "none", label: "No grouping" },
  { id: "chain", label: "Chain" },
] as const;

export type AssetGrouping = (typeof assetGroupingOptions)[number]["id"];
export type AssetGroupRow = {
  readonly children: ReadonlyArray<AssetTableRow>;
  readonly id: string;
  readonly kind: "group";
  readonly value: string;
};
export type AssetGridRow = AssetTableRow | AssetGroupRow;

export const isAssetGroup = (row: AssetGridRow): row is AssetGroupRow => "kind" in row;
export const getAssetRowId = (row: AssetGridRow): string => row.id;
export const getAssetChildren = (row: AssetGridRow) =>
  isAssetGroup(row) ? [...row.children] : undefined;

function TokenDisplay({ asset }: { asset: AssetTableRow }) {
  const symbol = getAssetSymbol(asset);
  const logoUrl = asset.addressMetadata?.identity.iconUrl ?? asset.metadata.logoUrl;
  const isVerified = asset.addressMetadata?.trust.isSourceVerified === true;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="shrink-0" size="sm">
        {logoUrl === null ? null : <Avatar.Image alt="" src={logoUrl} />}
        <Avatar.Fallback>{symbol.slice(0, 2).toUpperCase()}</Avatar.Fallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
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
        <Typography className="truncate text-xs!" color="muted">
          {symbol}
        </Typography>
      </div>
    </div>
  );
}

function TrustDisplay({ asset }: { readonly asset: AssetTableRow }) {
  const reputation = asset.addressMetadata?.trust.reputation ?? "unknown";
  const label =
    reputation === "credible"
      ? "Trusted"
      : reputation === "scam"
        ? "Scam"
        : reputation === "suspicious"
          ? "Suspicious"
          : reputation === "neutral"
            ? "Known"
            : "Unverified";
  return (
    <span
      className="inline-flex rounded-md bg-tertiary px-2 py-0.5 text-xs text-muted"
      data-reputation={reputation}
    >
      {label}
    </span>
  );
}

function GroupDisplay({ row }: { row: AssetGroupRow }) {
  const first = row.children[0];
  if (first === undefined) return null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <ChainDisplay chainId={first.chainId} />
      <span className="text-xs tabular-nums text-muted">{row.children.length}</span>
    </div>
  );
}

function TechnicalValue({ value }: { value: string }) {
  return (
    <span className="font-mono text-xs text-muted" title={value}>
      {`${value.slice(0, 6)}…${value.slice(-4)}`}
    </span>
  );
}

export const assetColumns: ReadonlyArray<DataGridColumn<AssetGridRow>> = [
  {
    allowsSorting: true,
    cell: (row) => (isAssetGroup(row) ? <GroupDisplay row={row} /> : <TokenDisplay asset={row} />),
    header: "Asset",
    id: "asset",
    isRowHeader: true,
    minWidth: 190,
    pinned: "start",
    width: "1fr",
  },
  {
    align: "end",
    allowsSorting: true,
    cell: (row) =>
      isAssetGroup(row) ? null : (
        <span className="text-sm tabular-nums">{formatBalance(row.formattedBalance)}</span>
      ),
    header: "Balance",
    id: "balance",
    minWidth: 120,
    width: 150,
  },
  {
    align: "end",
    allowsSorting: true,
    cell: (row) =>
      isAssetGroup(row) ? null : (
        <span className="text-sm tabular-nums text-muted">{formatUnitPrice(row.priceUsd)}</span>
      ),
    header: "Price",
    id: "price",
    minWidth: 100,
    width: 120,
  },
  {
    align: "end",
    allowsSorting: true,
    cell: (row) => {
      const value = isAssetGroup(row)
        ? row.children.reduce((sum, asset) => sum + (asset.valueUsd ?? 0), 0)
        : row.valueUsd;
      return value === null ? (
        <span className="text-sm text-muted">—</span>
      ) : (
        <span className="text-sm font-medium tabular-nums">{formatUsd(value)}</span>
      );
    },
    header: "Value",
    id: "value",
    minWidth: 110,
    width: 135,
  },
  {
    allowsSorting: true,
    cell: (row) => (isAssetGroup(row) ? null : <ChainDisplay chainId={row.chainId} />),
    header: "Chain",
    id: "chain",
    minWidth: 145,
    width: 180,
  },
  {
    allowsSorting: true,
    cell: (row) => (isAssetGroup(row) ? null : <TrustDisplay asset={row} />),
    header: "Trust",
    id: "trust",
    minWidth: 100,
    width: 115,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isAssetGroup(row) ? null : (
        <span className="text-sm capitalize text-muted">
          {row.type === "erc20" ? "ERC-20" : "Native"}
        </span>
      ),
    header: "Type",
    id: "type",
    minWidth: 90,
    width: 110,
  },
  {
    cell: (row) =>
      isAssetGroup(row) ? null : row.tokenAddress === null ? (
        <span className="text-sm text-muted">Native</span>
      ) : (
        <TechnicalValue value={row.tokenAddress} />
      ),
    header: "Contract",
    id: "contract",
    minWidth: 120,
    width: 140,
  },
  {
    align: "center",
    cell: (row) => (isAssetGroup(row) ? null : <AssetActions asset={row} />),
    cellClassName: "px-1",
    header: <span className="sr-only">Actions</span>,
    headerClassName: "px-1",
    id: "actions",
    maxWidth: 48,
    minWidth: 48,
    pinned: "end",
    width: 48,
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
  chain: (left, right) => collator.compare(left.chainId, right.chainId),
  type: (left, right) => collator.compare(left.type, right.type),
  trust: (left, right) =>
    collator.compare(
      left.addressMetadata?.trust.reputation ?? "unknown",
      right.addressMetadata?.trust.reputation ?? "unknown",
    ),
};

export const assetConfigurableColumns: ReadonlyArray<TableOption> = assetColumns
  .filter((column) => assetColumnIds.includes(column.id as (typeof assetColumnIds)[number]))
  .map((column) => ({ id: column.id, label: String(column.header) }));
export const assetSortableColumns: ReadonlyArray<TableOption> = assetColumns
  .filter((column) => column.allowsSorting)
  .map((column) => ({ id: column.id, label: String(column.header) }));
export const assetFixedColumnOptions = [
  { id: "asset", label: "Asset" },
  { id: "value", label: "Value" },
] as const;
