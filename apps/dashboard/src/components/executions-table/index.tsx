import { useMemo, useState } from "react";

import { chains as supportedEvmChains, getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type { SessionKeyId, WalletId } from "@namera-ai/protocol";
import type { ExecutionListItemResponse, ListExecutionsResponse } from "@namera-ai/protocol/dto";
import type { ActorType } from "@namera-ai/protocol/model";
import {
  DataGrid,
  SearchField,
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
  type TableFilterFacet,
} from "@/components/common/table";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import {
  ChainDisplay,
  ExecutionActorDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  actorDisplay,
} from "@/components/display";
import { useExecutions, useSessionKeyExecutions, useWalletExecutions } from "@/hooks/execution";
import { useSessionKeys } from "@/hooks/session-key";
import { useWallets } from "@/hooks/wallet";

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

const emptyExecutions: ReadonlyArray<ExecutionListItemResponse> = [];

type ExecutionsTableProps = {
  initialExecutions?: ListExecutionsResponse;
  variant?: "default" | "summary";
};

type ScopedExecutionsTableProps = {
  initialExecutions?: ListExecutionsResponse;
};

type ExecutionsQueryState = {
  readonly refetch: () => void;
  readonly isFetching: boolean;
  readonly data: ListExecutionsResponse | undefined;
  readonly isError: boolean;
  readonly isLoading: boolean;
};

type ExecutionTableScope = "organization" | "wallet" | "session-key";

type ExecutionsTableContentProps = {
  executions: ExecutionsQueryState;
  initialExecutions?: ListExecutionsResponse;
  scope: ExecutionTableScope;
  variant?: "default" | "summary";
};

function ExecutionsTableContent({
  executions,
  initialExecutions,
  scope,
  variant = "default",
}: ExecutionsTableContentProps) {
  const wallets = useWallets();
  const organizationSessionKeys = useSessionKeys();
  const items = executions.data?.items ?? initialExecutions?.items ?? emptyExecutions;
  const isInitialLoading =
    executions.isLoading && executions.data === undefined && initialExecutions === undefined;
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
  const fixedColumnId =
    scope === "organization" ? "account" : scope === "wallet" ? "sessionKey" : "namespace";

  const accountOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.wallet.id);
    const available = new Map<
      ExecutionListItemResponse["wallet"]["id"],
      Pick<ExecutionListItemResponse["wallet"], "id" | "metadata">
    >();
    for (const wallet of wallets.data ?? []) available.set(wallet.id, wallet);
    for (const item of items) available.set(item.wallet.id, item.wallet);

    return [...available.values()].map((wallet) => ({
      id: wallet.id,
      label: wallet.metadata.name,
      content: <MetadataDisplay fallbackName="Unnamed account" metadata={wallet.metadata} />,
      count: counts.get(wallet.id) ?? 0,
    }));
  }, [items, wallets.data]);
  const namespaceOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.details.namespace);
    const availableNamespaces = new Set<ExecutionListItemResponse["details"]["namespace"]>([
      "eip155",
      ...counts.keys(),
    ]);
    return [...availableNamespaces].map((namespace) => ({
      id: namespace,
      label: namespace,
      content: <NamespaceDisplay namespace={namespace} />,
      count: counts.get(namespace) ?? 0,
    }));
  }, [items]);
  const chainOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.details.chainId);
    const available = new Map(
      Object.values(supportedEvmChains).map((chain) => [chain.chainId, chain.chain.name] as const),
    );
    for (const item of items) {
      available.set(
        item.details.chainId,
        getExecutionChain(item)?.chain.name ?? item.details.chainId,
      );
    }

    return [...available].map(([chainId, label]) => ({
      group: getChainDataByCaip2(chainId)?.chain.testnet ? "Testnets" : "Mainnets",
      id: chainId,
      label,
      content: <ChainDisplay chainId={chainId} />,
      count: counts.get(chainId) ?? 0,
    }));
  }, [items]);
  const sessionKeyOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.sessionKey.id);
    const available = new Map<
      ExecutionListItemResponse["sessionKey"]["id"],
      Pick<ExecutionListItemResponse["sessionKey"], "id" | "metadata">
    >();
    for (const sessionKey of organizationSessionKeys.data ?? []) {
      available.set(sessionKey.id, sessionKey);
    }
    for (const item of items) available.set(item.sessionKey.id, item.sessionKey);

    return [...available.values()].map((sessionKey) => ({
      id: sessionKey.id,
      label: sessionKey.metadata.name,
      content: (
        <MetadataDisplay fallbackName="Unnamed session key" metadata={sessionKey.metadata} />
      ),
      count: counts.get(sessionKey.id) ?? 0,
    }));
  }, [items, organizationSessionKeys.data]);
  const actorOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.actorType);
    return (Object.entries(actorDisplay) as ReadonlyArray<[ActorType, { label: string }]>).map(
      ([type, display]) => ({
        id: type,
        label: display.label,
        content: <ExecutionActorDisplay type={type} />,
        count: counts.get(type) ?? 0,
      }),
    );
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
    if (grouping === "none") return variant === "summary" ? sorted.slice(0, 5) : sorted;
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
  }, [grouping, sorted, variant]);
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set(executionColumnIds) : visibleColumns;
    const columns = executionColumns.filter(
      (column) =>
        !(scope !== "organization" && column.id === "account") &&
        !(scope === "session-key" && column.id === "sessionKey") &&
        (column.id === fixedColumnId || column.id === "actions" || visible.has(column.id as never)),
    );
    const fixedColumnIndex = columns.findIndex((column) => column.id === fixedColumnId);
    const fixedColumn = columns[fixedColumnIndex];
    if (fixedColumn === undefined) return columns;

    return columns.toSpliced(fixedColumnIndex, 1, {
      ...fixedColumn,
      isRowHeader: true,
      pinned: "start" as const,
      width: "1fr" as const,
    });
  }, [fixedColumnId, scope, visibleColumns]);

  const facets = useMemo<ReadonlyArray<TableFilterFacet>>(() => {
    const availableFacets: TableFilterFacet[] = [];

    if (scope === "organization") {
      availableFacets.push({
        id: "account",
        label: "Account",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Wallet01Icon} />,
        selectedKeys: accounts,
        options: accountOptions,
        emptyLabel: "No accounts",
        onSelectionChange: (keys) =>
          setAccounts(
            toTableSelection(
              keys,
              accountOptions.map((option) => option.id),
            ),
          ),
      });
    }

    if (scope !== "session-key") {
      availableFacets.push({
        id: "session-key",
        label: "Session key",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Key01Icon} />,
        selectedKeys: sessionKeys,
        options: sessionKeyOptions,
        emptyLabel: "No session keys",
        onSelectionChange: (keys) =>
          setSessionKeys(
            toTableSelection(
              keys,
              sessionKeyOptions.map((option) => option.id),
            ),
          ),
      });
    }

    availableFacets.push(
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
        groups: ["Mainnets", "Testnets"],
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
    );

    return availableFacets;
  }, [
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
    scope,
  ]);
  const groupingOptions = useMemo(
    () =>
      executionGroupingOptions.filter(
        (option) =>
          (scope === "organization" || option.id !== "account") &&
          (scope !== "session-key" || option.id !== "sessionKey"),
      ),
    [scope],
  );
  const columnOptions = useMemo(
    () =>
      executionConfigurableColumns.filter(
        (option) =>
          (scope === "organization" || option.id !== "account") &&
          (scope !== "session-key" || option.id !== "sessionKey") &&
          option.id !== fixedColumnId,
      ),
    [fixedColumnId, scope],
  );
  const fixedColumnOptions = useMemo(
    () =>
      scope === "organization"
        ? executionFixedColumnOptions
        : [{ id: fixedColumnId, label: scope === "wallet" ? "Session key" : "Namespace" }],
    [fixedColumnId, scope],
  );
  const sortableColumns = useMemo(
    () =>
      executionSortableColumns.filter(
        (option) =>
          (scope === "organization" || option.id !== "account") &&
          (scope !== "session-key" || option.id !== "sessionKey"),
      ),
    [scope],
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
      {variant === "default" ? (
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
                columnOptions={columnOptions}
                fixedColumnOptions={fixedColumnOptions}
                grouping={grouping}
                groupingOptions={groupingOptions}
                sort={sort}
                sortableColumns={sortableColumns}
                visibleColumns={visibleColumns}
                onGroupingChange={handleGroupingChange}
                onReset={resetView}
                onSortChange={setSort}
                onVisibleColumnsChange={setVisibleColumns}
              />
            </TableControls>
          </div>
        </div>
      ) : null}

      {executions.isError ? (
        <DataError
          compact
          label="executions"
          onRetry={executions.refetch}
          isRetrying={executions.isFetching}
        />
      ) : null}
      {isInitialLoading ? (
        <DataLoading className="min-h-64" label="Loading executions" />
      ) : (
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
      )}
    </div>
  );
}

export function ExecutionsTable({ initialExecutions, variant }: ExecutionsTableProps) {
  const executions = useExecutions();
  return (
    <ExecutionsTableContent
      executions={executions}
      scope="organization"
      {...(initialExecutions === undefined ? {} : { initialExecutions })}
      {...(variant === undefined ? {} : { variant })}
    />
  );
}

export function WalletExecutionsTable({
  walletId,
  initialExecutions,
}: ScopedExecutionsTableProps & { walletId: WalletId }) {
  const executions = useWalletExecutions(walletId);
  return (
    <ExecutionsTableContent
      executions={executions}
      scope="wallet"
      {...(initialExecutions === undefined ? {} : { initialExecutions })}
    />
  );
}

export function SessionKeyExecutionsTable({
  sessionKeyId,
  initialExecutions,
}: ScopedExecutionsTableProps & { sessionKeyId: SessionKeyId }) {
  const executions = useSessionKeyExecutions(sessionKeyId);
  return (
    <ExecutionsTableContent
      executions={executions}
      scope="session-key"
      {...(initialExecutions === undefined ? {} : { initialExecutions })}
    />
  );
}

export type { ExecutionsTableProps, ScopedExecutionsTableProps };
