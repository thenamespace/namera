import { useMemo, useState } from "react";

import type { ExecutionListItemResponse, ListExecutionsResponse } from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  Typography,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import {
  BotIcon,
  ChainIcon,
  HugeiconsIcon,
  Key01Icon,
  Layers01Icon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";
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
import {
  ChainDisplay,
  ExecutionActorDisplay,
  MetadataDisplay,
  NamespaceDisplay,
} from "@/components/display";
import { useExecutions } from "@/hooks/execution";

import {
  executionColumnIds,
  executionColumns,
  executionConfigurableColumns,
  executionFixedColumnOptions,
  executionGroupingOptions,
  executionSorters,
  executionSortableColumns,
  getExecutionChildren,
  getExecutionRowId,
  type ExecutionGrouping,
  type ExecutionTableRow,
} from "./columns";
import { getActorLabel, getExecutionChain } from "./data";

type ExecutionsTableProps = {
  initialExecutions: ListExecutionsResponse;
};

export function ExecutionsTable({ initialExecutions }: ExecutionsTableProps) {
  const executions = useExecutions();
  const items = (executions.data ?? initialExecutions).items;
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<ReadonlySet<string>>(new Set());
  const [namespaces, setNamespaces] = useState<ReadonlySet<string>>(new Set());
  const [chains, setChains] = useState<ReadonlySet<string>>(new Set());
  const [sessionKeys, setSessionKeys] = useState<ReadonlySet<string>>(new Set());
  const [actors, setActors] = useState<ReadonlySet<string>>(new Set());
  const [grouping, setGrouping] = useState<ExecutionGrouping>("none");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(
    new Set(executionColumnIds),
  );
  const normalizedQuery = query.trim().toLowerCase();

  const accountOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.wallet.id);
    return [...uniqueTableValues(items, (item) => item.wallet.id).values()].map((item) => ({
      id: item.wallet.id,
      label: item.wallet.metadata.name,
      content: <MetadataDisplay fallbackName="Unnamed account" metadata={item.wallet.metadata} />,
      count: counts.get(item.wallet.id) ?? 0,
    }));
  }, [items]);
  const namespaceOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.details.namespace);
    return [...uniqueTableValues(items, (item) => item.details.namespace).values()].map((item) => ({
      id: item.details.namespace,
      label: item.details.namespace,
      content: <NamespaceDisplay namespace={item.details.namespace} />,
      count: counts.get(item.details.namespace) ?? 0,
    }));
  }, [items]);
  const chainOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.details.chainId);
    return [...uniqueTableValues(items, (item) => item.details.chainId).values()].map((item) => ({
      id: item.details.chainId,
      label: getExecutionChain(item)?.chain.name ?? item.details.chainId,
      content: <ChainDisplay chainId={item.details.chainId} />,
      count: counts.get(item.details.chainId) ?? 0,
    }));
  }, [items]);
  const sessionKeyOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.sessionKey.id);
    return [...uniqueTableValues(items, (item) => item.sessionKey.id).values()].map((item) => ({
      id: item.sessionKey.id,
      label: item.sessionKey.metadata.name,
      content: (
        <MetadataDisplay fallbackName="Unnamed session key" metadata={item.sessionKey.metadata} />
      ),
      count: counts.get(item.sessionKey.id) ?? 0,
    }));
  }, [items]);
  const actorOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.actorType);
    return [...uniqueTableValues(items, (item) => item.actorType).values()].map((item) => ({
      id: item.actorType,
      label: getActorLabel(item),
      content: <ExecutionActorDisplay type={item.actorType} />,
      count: counts.get(item.actorType) ?? 0,
    }));
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const chain = getExecutionChain(item);
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [
            item.details.id,
            item.details.namespace,
            item.details.chainId,
            chain?.chain.name,
            item.details.transactionHash,
            item.wallet.id,
            item.wallet.address,
            item.wallet.metadata.name,
            item.sessionKey.id,
            item.sessionKey.metadata.name,
            getActorLabel(item),
          ].some((value) => value?.toLowerCase().includes(normalizedQuery));

        return (
          matchesQuery &&
          (accounts.size === 0 || accounts.has(item.wallet.id)) &&
          (namespaces.size === 0 || namespaces.has(item.details.namespace)) &&
          (chains.size === 0 || chains.has(item.details.chainId)) &&
          (sessionKeys.size === 0 || sessionKeys.has(item.sessionKey.id)) &&
          (actors.size === 0 || actors.has(item.actorType))
        );
      }),
    [accounts, actors, chains, items, namespaces, normalizedQuery, sessionKeys],
  );
  const sorted = useMemo(() => {
    const sorter = executionSorters[String(sort.column)];
    if (sorter === undefined) return filtered;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.toSorted((left, right) => sorter(left, right) * direction);
  }, [filtered, sort]);
  const rows = useMemo<ExecutionTableRow[]>(() => {
    if (grouping === "none") return sorted;
    const grouped = new Map<string, ExecutionListItemResponse[]>();

    for (const item of sorted) {
      const value =
        grouping === "account"
          ? item.wallet.id
          : grouping === "sessionKey"
            ? item.sessionKey.id
            : grouping === "namespace"
              ? item.details.namespace
              : grouping === "chain"
                ? item.details.chainId
                : item.actorType;
      grouped.set(value, [...(grouped.get(value) ?? []), item]);
    }

    return [...grouped.entries()].map(([value, children]) => ({
      children,
      grouping,
      id: `group:${grouping}:${value}`,
      kind: "group",
      value,
    }));
  }, [grouping, sorted]);
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set(executionColumnIds) : visibleColumns;
    return executionColumns.filter(
      (column) =>
        column.id === "account" || column.id === "actions" || visible.has(column.id as never),
    );
  }, [visibleColumns]);

  const facets = useMemo<ReadonlyArray<TableFilterFacet>>(
    () => [
      {
        id: "account",
        label: "Account",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Wallet01Icon} />,
        selectedKeys: accounts,
        options: accountOptions,
        onSelectionChange: (keys) =>
          setAccounts(
            toTableSelection(
              keys,
              accountOptions.map((option) => option.id),
            ),
          ),
      },
      {
        id: "session-key",
        label: "Session key",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Key01Icon} />,
        selectedKeys: sessionKeys,
        options: sessionKeyOptions,
        onSelectionChange: (keys) =>
          setSessionKeys(
            toTableSelection(
              keys,
              sessionKeyOptions.map((option) => option.id),
            ),
          ),
      },
      {
        id: "namespace",
        label: "Namespace",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Layers01Icon} />,
        selectedKeys: namespaces,
        options: namespaceOptions,
        onSelectionChange: (keys) =>
          setNamespaces(
            toTableSelection(
              keys,
              namespaceOptions.map((option) => option.id),
            ),
          ),
      },
      {
        id: "chain",
        label: "Chain",
        icon: <ChainIcon className="size-4" chain="ethereum" namespace="eip155" />,
        selectedKeys: chains,
        options: chainOptions,
        onSelectionChange: (keys) =>
          setChains(
            toTableSelection(
              keys,
              chainOptions.map((option) => option.id),
            ),
          ),
      },
      {
        id: "actor",
        label: "Called by",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={BotIcon} />,
        selectedKeys: actors,
        options: actorOptions,
        onSelectionChange: (keys) =>
          setActors(
            toTableSelection(
              keys,
              actorOptions.map((option) => option.id),
            ),
          ),
      },
    ],
    [
      accountOptions,
      accounts,
      actorOptions,
      actors,
      chainOptions,
      chains,
      namespaceOptions,
      namespaces,
      sessionKeyOptions,
      sessionKeys,
    ],
  );
  const hasFilters =
    normalizedQuery.length > 0 ||
    accounts.size > 0 ||
    namespaces.size > 0 ||
    chains.size > 0 ||
    sessionKeys.size > 0 ||
    actors.size > 0;
  const renderEmptyState = useEventCallback(() =>
    hasFilters ? "No executions match these filters." : "No confirmed executions yet.",
  );
  const clearFilters = useEventCallback(() => {
    setQuery("");
    setAccounts(new Set());
    setNamespaces(new Set());
    setChains(new Set());
    setSessionKeys(new Set());
    setActors(new Set());
  });
  const resetView = useEventCallback(() => {
    setGrouping("none");
    setSort({ column: "createdAt", direction: "descending" });
    setVisibleColumns(new Set(executionColumnIds));
  });
  const handleGroupingChange = useEventCallback((value: string) => {
    setGrouping(value as ExecutionGrouping);
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <SearchField
          aria-label="Filter executions by wallet, session key, chain, actor, hash, or ID"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter executions…" />
            <SearchField.ClearButton aria-label="Clear execution search" />
          </SearchField.Group>
        </SearchField>
        <div className="ml-auto">
          <TableControls>
            <TableFilterControl
              ariaLabel="Apply execution filters"
              facets={facets}
              onClear={clearFilters}
            />
            <TableViewOptions
              ariaLabel="Configure execution table view"
              columnOptions={executionConfigurableColumns}
              fixedColumnOptions={executionFixedColumnOptions}
              grouping={grouping}
              groupingOptions={executionGroupingOptions}
              sort={sort}
              sortableColumns={executionSortableColumns}
              visibleColumns={visibleColumns}
              onGroupingChange={handleGroupingChange}
              onReset={resetView}
              onSortChange={setSort}
              onVisibleColumnsChange={setVisibleColumns}
            />
          </TableControls>
        </div>
      </div>

      {executions.isLoading ? <Typography color="muted">Loading executions…</Typography> : null}
      {executions.isError ? (
        <Typography className="text-danger">Couldn’t load executions.</Typography>
      ) : null}
      <DataGrid
        aria-label="Confirmed executions"
        columns={displayedColumns}
        data={rows}
        defaultExpandedKeys="all"
        getRowId={getExecutionRowId}
        key={grouping}
        renderEmptyState={renderEmptyState}
        sortDescriptor={sort}
        variant="secondary"
        onSortChange={setSort}
        {...(grouping === "none" ? {} : { getChildren: getExecutionChildren })}
      />
    </div>
  );
}

export type { ExecutionsTableProps };
