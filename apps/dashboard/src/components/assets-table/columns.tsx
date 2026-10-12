import type { DataGridColumn } from "@namera-ai/ui";

import {
  formatBalance,
  formatUnitPrice,
  formatUsd,
  getAssetName,
  type AssetTableRow,
} from "./data";
import { AssetTokenDisplay } from "./token-display";

export type AssetGridRow = AssetTableRow;

export const getAssetRowId = (row: AssetGridRow): string => row.id;

export const assetColumns: Array<DataGridColumn<AssetGridRow>> = [
  {
    allowsSorting: true,
    cell: (row) => <AssetTokenDisplay asset={row} />,
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
