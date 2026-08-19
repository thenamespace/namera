import { useMemo, useState } from "react";

import { Link } from "@tanstack/react-router";

import { DateTime } from "effect";

import type { ExecutionListItemResponse, ListExecutionsResponse } from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  Typography,
  type DataGridColumn,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import {
  ArrowUpRight01Icon,
  BotIcon,
  ChainIcon,
  HugeiconsIcon,
  Key01Icon,
  Layers01Icon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  TableControls,
  TableFilterControl,
  TableViewOptions,
  type TableFilterFacet,
  type TableOption,
} from "@/components/common/table";
import {
  ChainDisplay,
  DateDisplay,
  ExecutionActorDisplay,
  MetadataDisplay,
  NamespaceDisplay,
} from "@/components/display";
import { useExecutions } from "@/hooks/execution";

import { ExecutionActions } from "./actions";
import { getActorLabel, getExecutionChain, getTransactionUrl } from "./data";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const columnIds = ["namespace", "chain", "sessionKey", "actor", "txHash", "createdAt"] as const;
const groupingOptions = [
  { id: "none", label: "No grouping" },
  { id: "account", label: "Account" },
  { id: "sessionKey", label: "Session key" },
  { id: "namespace", label: "Namespace" },
  { id: "chain", label: "Chain" },
  { id: "actor", label: "Called by" },
] as const;
type Grouping = (typeof groupingOptions)[number]["id"];
type GroupRow = {
  children: ReadonlyArray<ExecutionListItemResponse>;
  grouping: Exclude<Grouping, "none">;
  id: string;
  kind: "group";
  value: string;
};
type Row = ExecutionListItemResponse | GroupRow;

const isGroup = (row: Row): row is GroupRow => "kind" in row;
const getRowId = (row: Row) => (isGroup(row) ? row.id : row.details.id);
const getChildren = (row: Row) => (isGroup(row) ? [...row.children] : undefined);

function GroupLabel({ row }: { row: GroupRow }) {
  const first = row.children[0];
  if (first === undefined) return null;

  return (
    <span className="flex min-w-0 items-center gap-2">
      {row.grouping === "account" ? (
        <MetadataDisplay fallbackName="Unnamed account" metadata={first.wallet.metadata} />
      ) : row.grouping === "sessionKey" ? (
        <MetadataDisplay fallbackName="Unnamed session key" metadata={first.sessionKey.metadata} />
      ) : row.grouping === "namespace" ? (
        <NamespaceDisplay namespace={first.details.namespace} />
      ) : row.grouping === "chain" ? (
        <ChainDisplay chainId={first.details.chainId} />
      ) : (
        <ExecutionActorDisplay type={first.actorType} />
      )}
      <span className="text-xs tabular-nums text-muted">{row.children.length}</span>
    </span>
  );
}

function AccountCell({ item }: { item: ExecutionListItemResponse }) {
  const params = useMemo(() => ({ accountId: item.wallet.id }), [item.wallet.id]);

  return (
    <Link
      className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      params={params}
      to="/account/$accountId/overview"
    >
      <MetadataDisplay fallbackName="Unnamed account" metadata={item.wallet.metadata} />
    </Link>
  );
}

function SessionKeyCell({ item }: { item: ExecutionListItemResponse }) {
  const params = useMemo(() => ({ sessionKeyId: item.sessionKey.id }), [item.sessionKey.id]);

  return (
    <Link
      className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      params={params}
      to="/session-key/$sessionKeyId/overview"
    >
      <MetadataDisplay fallbackName="Unnamed session key" metadata={item.sessionKey.metadata} />
    </Link>
  );
}

function TransactionCell({ item }: { item: ExecutionListItemResponse }) {
  const hash = item.details.transactionHash;
  const transactionUrl = getTransactionUrl(item);
  const compactHash = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  const content = (
    <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
      <span className="truncate">{compactHash}</span>
      {transactionUrl === undefined ? null : (
        <HugeiconsIcon className="size-3.5 shrink-0 text-muted" icon={ArrowUpRight01Icon} />
      )}
    </span>
  );

  return transactionUrl === undefined ? (
    <span title={hash}>{content}</span>
  ) : (
    <a
      className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      href={transactionUrl}
      rel="noopener noreferrer"
      target="_blank"
      title={hash}
    >
      {content}
    </a>
  );
}

const columns: ReadonlyArray<DataGridColumn<Row>> = [
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? <GroupLabel row={row} /> : <AccountCell item={row} />),
    header: "Wallet",
    id: "account",
    isRowHeader: true,
    minWidth: 170,
    pinned: "start",
    width: "1fr",
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <NamespaceDisplay namespace={row.details.namespace} />),
    header: "Namespace",
    id: "namespace",
    minWidth: 115,
    width: 140,
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <ChainDisplay chainId={row.details.chainId} />),
    header: "Chain",
    id: "chain",
    minWidth: 145,
    width: 180,
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <SessionKeyCell item={row} />),
    header: "Session key",
    id: "sessionKey",
    minWidth: 170,
    width: 210,
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <ExecutionActorDisplay type={row.actorType} />),
    header: "Called by",
    id: "actor",
    minWidth: 110,
    width: 130,
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <TransactionCell item={row} />),
    header: "Transaction",
    id: "txHash",
    minWidth: 150,
    width: 180,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isGroup(row) ? null : <DateDisplay label="Executed" value={row.details.createdAt} />,
    header: "Executed",
    id: "createdAt",
    minWidth: 130,
    width: 150,
  },
  {
    align: "center",
    allowsSorting: false,
    cell: (row) => (isGroup(row) ? null : <ExecutionActions execution={row} />),
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

const sorters: Record<
  string,
  (left: ExecutionListItemResponse, right: ExecutionListItemResponse) => number
> = {
  account: (left, right) => collator.compare(left.wallet.metadata.name, right.wallet.metadata.name),
  namespace: (left, right) => collator.compare(left.details.namespace, right.details.namespace),
  chain: (left, right) =>
    collator.compare(
      getExecutionChain(left)?.chain.name ?? left.details.chainId,
      getExecutionChain(right)?.chain.name ?? right.details.chainId,
    ),
  sessionKey: (left, right) =>
    collator.compare(left.sessionKey.metadata.name, right.sessionKey.metadata.name),
  actor: (left, right) => collator.compare(getActorLabel(left), getActorLabel(right)),
  txHash: (left, right) =>
    collator.compare(left.details.transactionHash, right.details.transactionHash),
  createdAt: (left, right) =>
    DateTime.toEpochMillis(left.details.createdAt) -
    DateTime.toEpochMillis(right.details.createdAt),
};

const configurableColumns: ReadonlyArray<TableOption> = columns
  .filter((column) => columnIds.includes(column.id as (typeof columnIds)[number]))
  .map((column) => ({ id: column.id, label: String(column.header) }));
const sortableColumns: ReadonlyArray<TableOption> = columns
  .filter((column) => column.allowsSorting)
  .map((column) => ({ id: column.id, label: String(column.header) }));
const fixedColumnOptions = [{ id: "account", label: "Wallet" }] as const;

type ExecutionsTableProps = {
  initialExecutions: ListExecutionsResponse;
};

export function ExecutionsTable({ initialExecutions }: ExecutionsTableProps) {
  const executions = useExecutions();
  const data = executions.data ?? initialExecutions;
  const items = data.items;
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<ReadonlySet<string>>(new Set());
  const [namespaces, setNamespaces] = useState<ReadonlySet<string>>(new Set());
  const [chainsFilter, setChainsFilter] = useState<ReadonlySet<string>>(new Set());
  const [sessionKeys, setSessionKeys] = useState<ReadonlySet<string>>(new Set());
  const [actors, setActors] = useState<ReadonlySet<string>>(new Set());
  const [grouping, setGrouping] = useState<Grouping>("none");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(new Set(columnIds));
  const normalizedQuery = query.trim().toLowerCase();

  const accountOptions = useMemo(
    () =>
      [...new Map(items.map((item) => [item.wallet.id, item.wallet])).values()].map((wallet) => ({
        id: wallet.id,
        label: wallet.metadata.name,
        content: <MetadataDisplay fallbackName="Unnamed account" metadata={wallet.metadata} />,
        count: items.filter((item) => item.wallet.id === wallet.id).length,
      })),
    [items],
  );
  const namespaceOptions = useMemo(
    () =>
      [...new Set(items.map((item) => item.details.namespace))].map((namespace) => ({
        id: namespace,
        label: namespace,
        content: <NamespaceDisplay namespace={namespace} />,
        count: items.filter((item) => item.details.namespace === namespace).length,
      })),
    [items],
  );
  const chainOptions = useMemo(
    () =>
      [...new Map(items.map((item) => [item.details.chainId, item] as const)).values()].map(
        (item) => ({
          id: item.details.chainId,
          label: getExecutionChain(item)?.chain.name ?? item.details.chainId,
          content: <ChainDisplay chainId={item.details.chainId} />,
          count: items.filter((candidate) => candidate.details.chainId === item.details.chainId)
            .length,
        }),
      ),
    [items],
  );
  const sessionKeyOptions = useMemo(
    () =>
      [...new Map(items.map((item) => [item.sessionKey.id, item.sessionKey])).values()].map(
        (sessionKey) => ({
          id: sessionKey.id,
          label: sessionKey.metadata.name,
          content: (
            <MetadataDisplay fallbackName="Unnamed session key" metadata={sessionKey.metadata} />
          ),
          count: items.filter((item) => item.sessionKey.id === sessionKey.id).length,
        }),
      ),
    [items],
  );
  const actorOptions = useMemo(
    () =>
      [...new Map(items.map((item) => [item.actorType, item] as const)).values()].map((item) => ({
        id: item.actorType,
        label: getActorLabel(item),
        content: <ExecutionActorDisplay type={item.actorType} />,
        count: items.filter((candidate) => candidate.actorType === item.actorType).length,
      })),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const chain = getExecutionChain(item);
        const searchable = [
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
        ];
        const matchesQuery =
          normalizedQuery.length === 0 ||
          searchable.some((value) => value?.toLowerCase().includes(normalizedQuery));

        return (
          matchesQuery &&
          (accounts.size === 0 || accounts.has(item.wallet.id)) &&
          (namespaces.size === 0 || namespaces.has(item.details.namespace)) &&
          (chainsFilter.size === 0 || chainsFilter.has(item.details.chainId)) &&
          (sessionKeys.size === 0 || sessionKeys.has(item.sessionKey.id)) &&
          (actors.size === 0 || actors.has(item.actorType))
        );
      }),
    [accounts, actors, chainsFilter, items, namespaces, normalizedQuery, sessionKeys],
  );
  const sorted = useMemo(() => {
    const sorter = sorters[String(sort.column)];
    if (sorter === undefined) return filtered;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.toSorted((left, right) => sorter(left, right) * direction);
  }, [filtered, sort]);
  const rows = useMemo<Row[]>(() => {
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
    const visible = visibleColumns === "all" ? new Set(columnIds) : visibleColumns;
    return columns.filter(
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
            keys === "all"
              ? new Set(accountOptions.map((option) => option.id))
              : new Set([...keys].map(String)),
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
            keys === "all"
              ? new Set(sessionKeyOptions.map((option) => option.id))
              : new Set([...keys].map(String)),
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
            keys === "all"
              ? new Set(namespaceOptions.map((option) => option.id))
              : new Set([...keys].map(String)),
          ),
      },
      {
        id: "chain",
        label: "Chain",
        icon: <ChainIcon className="size-4" chain="ethereum" namespace="eip155" />,
        selectedKeys: chainsFilter,
        options: chainOptions,
        onSelectionChange: (keys) =>
          setChainsFilter(
            keys === "all"
              ? new Set(chainOptions.map((option) => option.id))
              : new Set([...keys].map(String)),
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
            keys === "all"
              ? new Set(actorOptions.map((option) => option.id))
              : new Set([...keys].map(String)),
          ),
      },
    ],
    [
      accountOptions,
      accounts,
      actorOptions,
      actors,
      chainOptions,
      chainsFilter,
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
    chainsFilter.size > 0 ||
    sessionKeys.size > 0 ||
    actors.size > 0;
  const renderEmptyState = useEventCallback(() =>
    hasFilters ? "No executions match these filters." : "No confirmed executions yet.",
  );
  const clearFilters = useEventCallback(() => {
    setAccounts(new Set());
    setNamespaces(new Set());
    setChainsFilter(new Set());
    setSessionKeys(new Set());
    setActors(new Set());
  });
  const resetView = useEventCallback(() => {
    setGrouping("none");
    setSort({ column: "createdAt", direction: "descending" });
    setVisibleColumns(new Set(columnIds));
  });
  const handleGroupingChange = useEventCallback((value: string) => {
    setGrouping(value as Grouping);
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
              columnOptions={configurableColumns}
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

      {executions.isLoading ? <Typography color="muted">Loading executions…</Typography> : null}
      {executions.isError ? (
        <Typography className="text-danger">Couldn’t load executions.</Typography>
      ) : null}
      <DataGrid
        aria-label="Confirmed executions"
        columns={displayedColumns}
        data={rows}
        defaultExpandedKeys="all"
        getRowId={getRowId}
        key={grouping}
        renderEmptyState={renderEmptyState}
        sortDescriptor={sort}
        variant="secondary"
        onSortChange={setSort}
        {...(grouping === "none" ? {} : { getChildren })}
      />
    </div>
  );
}

export type { ExecutionsTableProps };
