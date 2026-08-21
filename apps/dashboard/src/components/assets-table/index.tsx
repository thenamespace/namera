import { useMemo, useState } from "react";

import { getChainDataByCaip2 } from "@namera-ai/evm";
import type { EthereumAddress } from "@namera-ai/protocol";
import type { WalletAsset } from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import { ChainIcon, Coins01Icon, HugeiconsIcon, Tag01Icon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  countTableValues,
  TableControls,
  TableFilterControl,
  TableViewOptions,
  toTableSelection,
  uniqueTableValues,
  type TableFilterFacet,
} from "@/components/common/table";
import { ChainDisplay } from "@/components/display";

import {
  assetColumnIds,
  assetColumns,
  assetConfigurableColumns,
  assetFixedColumnOptions,
  assetGroupingOptions,
  assetSorters,
  assetSortableColumns,
  getAssetChildren,
  getAssetRowId,
  type AssetGridRow,
  type AssetGrouping,
} from "./columns";
import { getAssetName, getAssetSymbol, summarizePortfolio } from "./data";

type AssetsTableProps = {
  readonly address: EthereumAddress;
  readonly assets: ReadonlyArray<WalletAsset>;
};

export function AssetsTable({ address, assets }: AssetsTableProps) {
  const portfolio = useMemo(() => summarizePortfolio(assets, address), [address, assets]);
  const [query, setQuery] = useState("");
  const [chains, setChains] = useState<ReadonlySet<string>>(new Set());
  const [types, setTypes] = useState<ReadonlySet<string>>(new Set());
  const [pricing, setPricing] = useState<ReadonlySet<string>>(new Set());
  const [grouping, setGrouping] = useState<AssetGrouping>("none");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "value",
    direction: "descending",
  });
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(
    new Set(["balance", "price", "value", "chain"]),
  );
  const normalizedQuery = query.trim().toLowerCase();

  const chainOptions = useMemo(() => {
    const counts = countTableValues(portfolio.rows, (row) => row.chainId);
    return [...uniqueTableValues(portfolio.rows, (row) => row.chainId).values()].map((row) => ({
      id: row.chainId,
      label: getChainDataByCaip2(row.chainId)?.chain.name ?? row.chainId,
      content: <ChainDisplay chainId={row.chainId} />,
      count: counts.get(row.chainId) ?? 0,
    }));
  }, [portfolio.rows]);
  const typeOptions = useMemo(() => {
    const counts = countTableValues(portfolio.rows, (row) => row.type);
    return [
      { id: "native", label: "Native", count: counts.get("native") ?? 0 },
      { id: "erc20", label: "ERC-20", count: counts.get("erc20") ?? 0 },
    ];
  }, [portfolio.rows]);
  const pricingOptions = useMemo(() => {
    const priced = portfolio.rows.filter((row) => row.priceUsd !== null).length;
    return [
      { id: "priced", label: "Priced", count: priced },
      { id: "unpriced", label: "Unpriced", count: portfolio.rows.length - priced },
    ];
  }, [portfolio.rows]);

  const filtered = useMemo(
    () =>
      portfolio.rows.filter((row) => {
        const chain = getChainDataByCaip2(row.chainId)?.chain.name;
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [getAssetName(row), getAssetSymbol(row), row.tokenAddress, row.chainId, chain].some(
            (value) => value?.toLowerCase().includes(normalizedQuery),
          );
        const pricingId = row.priceUsd === null ? "unpriced" : "priced";
        return (
          matchesQuery &&
          (chains.size === 0 || chains.has(row.chainId)) &&
          (types.size === 0 || types.has(row.type)) &&
          (pricing.size === 0 || pricing.has(pricingId))
        );
      }),
    [chains, normalizedQuery, portfolio.rows, pricing, types],
  );
  const sorted = useMemo(() => {
    const sorter = assetSorters[String(sort.column)];
    if (sorter === undefined) return filtered;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.toSorted((left, right) => sorter(left, right) * direction);
  }, [filtered, sort]);
  const rows = useMemo<AssetGridRow[]>(() => {
    if (grouping === "none") return sorted;
    const grouped = new Map<string, typeof sorted>();
    for (const row of sorted) grouped.set(row.chainId, [...(grouped.get(row.chainId) ?? []), row]);
    return [...grouped.entries()].map(([value, children]) => ({
      children,
      id: `group:chain:${value}`,
      kind: "group",
      value,
    }));
  }, [grouping, sorted]);
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set(assetColumnIds) : visibleColumns;
    return assetColumns.filter(
      (column) =>
        column.id === "asset" ||
        column.id === "value" ||
        column.id === "actions" ||
        visible.has(column.id as never),
    );
  }, [visibleColumns]);

  const facets = useMemo<ReadonlyArray<TableFilterFacet>>(
    () => [
      {
        id: "chain",
        label: "Chain",
        icon: <ChainIcon className="size-4" chain="ethereum" namespace="eip155" />,
        options: chainOptions,
        selectedKeys: chains,
        onSelectionChange: (keys) =>
          setChains(
            toTableSelection(
              keys,
              chainOptions.map((option) => option.id),
            ),
          ),
      },
      {
        id: "type",
        label: "Asset type",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Coins01Icon} />,
        options: typeOptions,
        selectedKeys: types,
        onSelectionChange: (keys) =>
          setTypes(
            toTableSelection(
              keys,
              typeOptions.map((option) => option.id),
            ),
          ),
      },
      {
        id: "pricing",
        label: "Pricing",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Tag01Icon} />,
        options: pricingOptions,
        selectedKeys: pricing,
        onSelectionChange: (keys) =>
          setPricing(
            toTableSelection(
              keys,
              pricingOptions.map((option) => option.id),
            ),
          ),
      },
    ],
    [chainOptions, chains, pricing, pricingOptions, typeOptions, types],
  );
  const hasFilters =
    normalizedQuery.length > 0 || chains.size > 0 || types.size > 0 || pricing.size > 0;
  const clearFilters = useEventCallback(() => {
    setQuery("");
    setChains(new Set());
    setTypes(new Set());
    setPricing(new Set());
  });
  const resetView = useEventCallback(() => {
    setGrouping("none");
    setSort({ column: "value", direction: "descending" });
    setVisibleColumns(new Set(["balance", "price", "value", "chain"]));
  });
  const renderEmptyState = useEventCallback(() =>
    hasFilters ? "No assets match these filters." : "No fungible assets found.",
  );
  const handleGroupingChange = useEventCallback((value: string) => {
    setGrouping(value as AssetGrouping);
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <SearchField
          aria-label="Filter assets by name, symbol, contract, or chain"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter assets…" />
            <SearchField.ClearButton aria-label="Clear asset search" />
          </SearchField.Group>
        </SearchField>
        <div className="ml-auto">
          <TableControls>
            <TableFilterControl
              ariaLabel="Apply asset filters"
              facets={facets}
              onClear={clearFilters}
            />
            <TableViewOptions
              ariaLabel="Configure asset table view"
              columnOptions={assetConfigurableColumns}
              fixedColumnOptions={assetFixedColumnOptions}
              grouping={grouping}
              groupingOptions={assetGroupingOptions}
              sort={sort}
              sortableColumns={assetSortableColumns}
              visibleColumns={visibleColumns}
              onGroupingChange={handleGroupingChange}
              onReset={resetView}
              onSortChange={setSort}
              onVisibleColumnsChange={setVisibleColumns}
            />
          </TableControls>
        </div>
      </div>
      <DataGrid
        aria-label="Account assets"
        columns={displayedColumns}
        data={rows}
        defaultExpandedKeys="all"
        getRowId={getAssetRowId}
        key={grouping}
        renderEmptyState={renderEmptyState}
        sortDescriptor={sort}
        variant="secondary"
        onSortChange={setSort}
        {...(grouping === "none" ? {} : { getChildren: getAssetChildren })}
      />
    </div>
  );
}

export { summarizePortfolio } from "./data";
export type { AssetAllocation } from "./data";
export type { AssetsTableProps };
