import { useMemo, useState } from "react";

import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type { EthereumAddress } from "@namera-ai/protocol";
import type { PortfolioAsset } from "@namera-ai/protocol/dto";
import { Button, DataGrid, SearchField, type DataGridSortDescriptor } from "@namera-ai/ui";
import { ChainIcon, Coins01Icon, HugeiconsIcon, Tag01Icon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  countTableValues,
  TableControls,
  TableFilterControl,
  toTableSelection,
  uniqueTableValues,
  type TableFilterFacet,
} from "@/components/common/table";
import { ChainDisplay } from "@/components/display";

import { AssetViewOptions } from "./asset-view-options";
import { assetColumns, assetSorters, getAssetRowId, type AssetGridRow } from "./columns";
import { getAssetName, getAssetSymbol, summarizePortfolio } from "./data";

type AssetsTableProps = {
  readonly address: EthereumAddress;
  readonly assets: ReadonlyArray<PortfolioAsset>;
  readonly showTestnets: boolean;
  readonly onShowTestnetsChange: (showTestnets: boolean) => void;
};

export function AssetsTable({
  address,
  assets,
  showTestnets,
  onShowTestnetsChange,
}: AssetsTableProps) {
  const portfolio = useMemo(() => summarizePortfolio(assets, address), [address, assets]);
  const [query, setQuery] = useState("");
  const [chains, setChains] = useState<ReadonlySet<string>>(new Set());
  const [types, setTypes] = useState<ReadonlySet<string>>(new Set());
  const [pricing, setPricing] = useState<ReadonlySet<string>>(new Set());
  const [trust, setTrust] = useState<ReadonlySet<string>>(new Set(["credible", "unknown"]));
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "value",
    direction: "descending",
  });
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
  const trustOptions = useMemo(() => {
    const counts = countTableValues(
      portfolio.rows,
      (row) => row.addressMetadata?.trust.reputation ?? "unknown",
    );
    return [
      { id: "credible", label: "Trusted", count: counts.get("credible") ?? 0 },
      { id: "neutral", label: "Known", count: counts.get("neutral") ?? 0 },
      { id: "unknown", label: "Unverified", count: counts.get("unknown") ?? 0 },
      { id: "suspicious", label: "Suspicious", count: counts.get("suspicious") ?? 0 },
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
        const trustId = row.addressMetadata?.trust.reputation ?? "unknown";
        return (
          matchesQuery &&
          (chains.size === 0 || chains.has(row.chainId)) &&
          (types.size === 0 || types.has(row.type)) &&
          (pricing.size === 0 || pricing.has(pricingId)) &&
          (trust.size === 0 || trust.has(trustId))
        );
      }),
    [chains, normalizedQuery, portfolio.rows, pricing, trust, types],
  );
  const sorted = useMemo(() => {
    const sorter = assetSorters[String(sort.column)];
    if (sorter === undefined) return filtered;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.toSorted((left, right) => sorter(left, right) * direction);
  }, [filtered, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / 10));
  const effectivePage = Math.min(page, pageCount);
  const rows = useMemo<AssetGridRow[]>(
    () => sorted.slice((effectivePage - 1) * 10, effectivePage * 10),
    [effectivePage, sorted],
  );

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
        id: "trust",
        label: "Trust",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Tag01Icon} />,
        options: trustOptions,
        selectedKeys: trust,
        onSelectionChange: (keys) =>
          setTrust(
            toTableSelection(
              keys,
              trustOptions.map((option) => option.id),
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
    [chainOptions, chains, pricing, pricingOptions, trust, trustOptions, typeOptions, types],
  );
  const hasFilters =
    normalizedQuery.length > 0 ||
    chains.size > 0 ||
    types.size > 0 ||
    pricing.size > 0 ||
    trust.size > 0;
  const clearFilters = useEventCallback(() => {
    setQuery("");
    setChains(new Set());
    setTypes(new Set());
    setPricing(new Set());
    setTrust(new Set());
    setPage(1);
  });
  const renderEmptyState = useEventCallback(() =>
    hasFilters ? "No assets match these filters." : "No fungible assets found.",
  );
  const showPreviousPage = useEventCallback(() => {
    setPage((current) => Math.max(1, current - 1));
  });
  const showNextPage = useEventCallback(() => {
    setPage((current) => Math.min(pageCount, current + 1));
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
            <AssetViewOptions
              showTestnets={showTestnets}
              onShowTestnetsChange={onShowTestnetsChange}
            />
          </TableControls>
        </div>
      </div>
      <DataGrid
        aria-label="Account assets"
        columns={assetColumns}
        data={rows}
        getRowId={getAssetRowId}
        renderEmptyState={renderEmptyState}
        sortDescriptor={sort}
        variant="secondary"
        onSortChange={setSort}
      />
      <div className="flex items-center justify-between gap-4 px-1">
        <span className="text-xs tabular-nums text-muted">
          {sorted.length === 0
            ? "0 assets"
            : `${(effectivePage - 1) * 10 + 1}–${Math.min(effectivePage * 10, sorted.length)} of ${sorted.length}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            isDisabled={effectivePage === 1}
            size="sm"
            variant="tertiary"
            onPress={showPreviousPage}
          >
            Previous
          </Button>
          <span className="min-w-14 text-center text-xs tabular-nums text-muted">
            {effectivePage} / {pageCount}
          </span>
          <Button
            isDisabled={effectivePage === pageCount}
            size="sm"
            variant="tertiary"
            onPress={showNextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export { summarizePortfolio } from "./data";
export type { AssetAllocation } from "./data";
export type { AssetsTableProps };
