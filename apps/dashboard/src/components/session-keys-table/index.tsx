import { useMemo, useState } from "react";

import { Link } from "@tanstack/react-router";

import { DateTime } from "effect";

import type { WalletId } from "@namera-ai/protocol";
import type {
  ListSessionKeysForOrganizationResponse,
  ListSessionKeysForWalletResponse,
  SessionKeyResponse,
} from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  Typography,
  type DataGridColumn,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import { Activity01Icon, HugeiconsIcon, Key01Icon, Layers01Icon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  TableControls,
  TableFilterControl,
  TableViewOptions,
  type TableFilterFacet,
  type TableOption,
} from "@/components/common/table";
import {
  DateDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  SessionKeyStatusDisplay,
} from "@/components/display";
import { useSessionKeys, useWalletSessionKeys } from "@/hooks/session-key";

import { SessionKeyActions } from "./actions";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const columnIds = ["account", "namespace", "creator", "status", "createdAt"] as const;
const statusOptions = ["active", "revoked"] as const;
const groupingOptions = [
  { id: "none", label: "No grouping" },
  { id: "status", label: "Status" },
  { id: "account", label: "Account" },
  { id: "namespace", label: "Namespace" },
] as const;
type Grouping = (typeof groupingOptions)[number]["id"];
type GroupRow = {
  children: ReadonlyArray<SessionKeyResponse>;
  grouping: Exclude<Grouping, "none">;
  id: string;
  kind: "group";
  label: string;
};
type Row = SessionKeyResponse | GroupRow;
const isGroup = (row: Row): row is GroupRow => "kind" in row;

function GroupLabel({ row }: { row: GroupRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {row.grouping === "status" ? (
        <SessionKeyStatusDisplay status={row.label as SessionKeyResponse["status"]} />
      ) : row.grouping === "namespace" ? (
        <NamespaceDisplay namespace={row.label as SessionKeyResponse["namespace"]} />
      ) : (
        row.label
      )}
      <span className="text-xs tabular-nums text-muted">{row.children.length}</span>
    </span>
  );
}

function SessionKeyNameCell({ sessionKey }: { sessionKey: SessionKeyResponse }) {
  const sessionKeyParams = useMemo(() => ({ sessionKeyId: sessionKey.id }), [sessionKey.id]);

  return (
    <Link
      className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      params={sessionKeyParams}
      to="/session-key/$sessionKeyId/overview"
    >
      <MetadataDisplay fallbackName="Unnamed session key" metadata={sessionKey.metadata} />
    </Link>
  );
}

const columns: ReadonlyArray<DataGridColumn<Row>> = [
  {
    allowsSorting: true,
    cell: (row) =>
      isGroup(row) ? <GroupLabel row={row} /> : <SessionKeyNameCell sessionKey={row} />,
    header: "Name",
    id: "name",
    isRowHeader: true,
    minWidth: 160,
    pinned: "start",
    width: "1fr",
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isGroup(row) ? null : (
        <MetadataDisplay fallbackName="Unnamed account" metadata={row.wallet.metadata} />
      ),
    header: "Account",
    id: "account",
    minWidth: 150,
    width: 190,
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <NamespaceDisplay namespace={row.namespace} />),
    header: "Namespace",
    id: "namespace",
    minWidth: 120,
    width: 150,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isGroup(row) ? null : (
        <MetadataDisplay
          fallbackName={row.creator.user.email}
          metadata={row.creator.user.metadata}
        />
      ),
    header: "Created by",
    id: "creator",
    minWidth: 150,
    width: 190,
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <SessionKeyStatusDisplay status={row.status} />),
    header: "Status",
    id: "status",
    minWidth: 100,
    width: 120,
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <DateDisplay label="Created" value={row.createdAt} />),
    header: "Created",
    id: "createdAt",
    minWidth: 130,
    width: 150,
  },
  {
    align: "center",
    allowsSorting: false,
    cell: (row) => (isGroup(row) ? null : <SessionKeyActions sessionKey={row} />),
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

const sorters: Record<string, (left: SessionKeyResponse, right: SessionKeyResponse) => number> = {
  name: (left, right) => collator.compare(left.metadata.name, right.metadata.name),
  status: (left, right) => collator.compare(left.status, right.status),
  account: (left, right) => collator.compare(left.wallet.metadata.name, right.wallet.metadata.name),
  creator: (left, right) =>
    collator.compare(
      left.creator.user.metadata.name ?? left.creator.user.email,
      right.creator.user.metadata.name ?? right.creator.user.email,
    ),
  namespace: (left, right) => collator.compare(left.namespace, right.namespace),
  createdAt: (left, right) =>
    DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
};
const configurableColumns: ReadonlyArray<TableOption> = columns
  .filter((column) => columnIds.includes(column.id as (typeof columnIds)[number]))
  .map((column) => ({ id: column.id, label: String(column.header) }));
const sortableColumns: ReadonlyArray<TableOption> = columns
  .filter((column) => column.allowsSorting)
  .map((column) => ({ id: column.id, label: String(column.header) }));
const getRowId = (row: Row) => row.id;
const getChildren = (row: Row) => (isGroup(row) ? [...row.children] : undefined);
const fixedColumnOptions = [{ id: "name", label: "Name" }] as const;

function toSelection<T extends string>(keys: DataGridSelection, options: ReadonlyArray<T>): Set<T> {
  if (keys === "all") return new Set(options);
  return new Set([...keys].filter((key): key is T => typeof key === "string"));
}

type SessionKeysTableProps = {
  initialSessionKeys: ListSessionKeysForOrganizationResponse;
};

export function SessionKeysTable({ initialSessionKeys }: SessionKeysTableProps) {
  const sessionKeys = useSessionKeys();
  return (
    <SessionKeysTableContent
      ariaLabel="Organization session keys"
      data={sessionKeys.data ?? initialSessionKeys}
      isError={sessionKeys.isError}
      isLoading={sessionKeys.isLoading}
    />
  );
}

type WalletSessionKeysTableProps = {
  initialSessionKeys: ListSessionKeysForWalletResponse;
  walletId: WalletId;
};

export function WalletSessionKeysTable({
  initialSessionKeys,
  walletId,
}: WalletSessionKeysTableProps) {
  const sessionKeys = useWalletSessionKeys(walletId);
  return (
    <SessionKeysTableContent
      ariaLabel="Account session keys"
      data={sessionKeys.data ?? initialSessionKeys}
      isError={sessionKeys.isError}
      isLoading={sessionKeys.isLoading}
    />
  );
}

type SessionKeysTableContentProps = {
  ariaLabel: string;
  data: ReadonlyArray<SessionKeyResponse>;
  isError: boolean;
  isLoading: boolean;
};

function SessionKeysTableContent({
  ariaLabel,
  data,
  isError,
  isLoading,
}: SessionKeysTableContentProps) {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<ReadonlySet<SessionKeyResponse["status"]>>(new Set());
  const [accounts, setAccounts] = useState<ReadonlySet<string>>(new Set());
  const [namespaces, setNamespaces] = useState<ReadonlySet<string>>(new Set());
  const [grouping, setGrouping] = useState<Grouping>("none");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(new Set(columnIds));
  const normalizedQuery = query.trim().toLowerCase();
  const accountOptions = useMemo(
    () =>
      [...new Map(data.map((item) => [item.wallet.id, item.wallet])).values()].map((wallet) => ({
        id: wallet.id,
        label: wallet.metadata.name,
        content: <MetadataDisplay fallbackName="Unnamed account" metadata={wallet.metadata} />,
        count: data.filter((item) => item.wallet.id === wallet.id).length,
      })),
    [data],
  );
  const namespaceOptions = useMemo(
    () =>
      [...new Set(data.map((item) => item.namespace))].map((namespace) => ({
        id: namespace,
        label: namespace,
        content: <NamespaceDisplay namespace={namespace} />,
        count: data.filter((item) => item.namespace === namespace).length,
      })),
    [data],
  );
  const filtered = useMemo(
    () =>
      data.filter((item) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          item.metadata.name.toLowerCase().includes(normalizedQuery) ||
          item.id.toLowerCase().includes(normalizedQuery) ||
          item.wallet.metadata.name.toLowerCase().includes(normalizedQuery) ||
          item.wallet.address.toLowerCase().includes(normalizedQuery) ||
          item.creator.user.email.toLowerCase().includes(normalizedQuery);
        return (
          matchesQuery &&
          (statuses.size === 0 || statuses.has(item.status)) &&
          (accounts.size === 0 || accounts.has(item.wallet.id)) &&
          (namespaces.size === 0 || namespaces.has(item.namespace))
        );
      }),
    [accounts, data, namespaces, normalizedQuery, statuses],
  );
  const sorted = useMemo(() => {
    const sorter = sorters[String(sort.column)];
    if (!sorter) return filtered;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.toSorted((left, right) => sorter(left, right) * direction);
  }, [filtered, sort]);
  const rows = useMemo<Row[]>(() => {
    if (grouping === "none") return sorted;
    const grouped = new Map<string, SessionKeyResponse[]>();
    for (const item of sorted) {
      const value = grouping === "account" ? item.wallet.metadata.name : String(item[grouping]);
      grouped.set(value, [...(grouped.get(value) ?? []), item]);
    }
    return [...grouped.entries()].map(([label, children]) => ({
      children,
      grouping,
      id: `group:${grouping}:${label}`,
      kind: "group",
      label,
    }));
  }, [grouping, sorted]);
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set(columnIds) : visibleColumns;
    return columns.filter(
      (column) =>
        column.id === "name" || column.id === "actions" || visible.has(column.id as never),
    );
  }, [visibleColumns]);
  const facets = useMemo<ReadonlyArray<TableFilterFacet>>(
    () => [
      {
        id: "status",
        label: "Status",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Activity01Icon} />,
        selectedKeys: statuses,
        options: statusOptions.map((value) => ({
          id: value,
          label: value === "active" ? "Active" : "Revoked",
          content: <SessionKeyStatusDisplay status={value} />,
          count: data.filter((item) => item.status === value).length,
        })),
        onSelectionChange: (keys) => setStatuses(toSelection(keys, statusOptions)),
      },
      {
        id: "account",
        label: "Account",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Key01Icon} />,
        selectedKeys: accounts,
        options: accountOptions,
        onSelectionChange: (keys) =>
          setAccounts(
            keys === "all"
              ? new Set(accountOptions.map((item) => item.id))
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
              ? new Set(namespaceOptions.map((item) => item.id))
              : new Set([...keys].map(String)),
          ),
      },
    ],
    [accountOptions, accounts, data, namespaceOptions, namespaces, statuses],
  );
  const hasFilters =
    normalizedQuery.length > 0 || statuses.size > 0 || accounts.size > 0 || namespaces.size > 0;
  const renderEmptyState = useEventCallback(() =>
    hasFilters ? "No session keys match these filters." : "No session keys yet.",
  );
  const resetView = useEventCallback(() => {
    setGrouping("none");
    setSort({ column: "createdAt", direction: "descending" });
    setVisibleColumns(new Set(columnIds));
  });
  const clearFilters = useEventCallback(() => {
    setStatuses(new Set());
    setAccounts(new Set());
    setNamespaces(new Set());
  });
  const handleGroupingChange = useEventCallback((value: string) => {
    setGrouping(value as Grouping);
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <SearchField
          aria-label="Filter session keys by name, account, creator, address, or ID"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter session keys…" />
            <SearchField.ClearButton aria-label="Clear session key search" />
          </SearchField.Group>
        </SearchField>
        <div className="ml-auto">
          <TableControls>
            <TableFilterControl
              ariaLabel="Apply session key filters"
              facets={facets}
              onClear={clearFilters}
            />
            <TableViewOptions
              ariaLabel="Configure session key table view"
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

      {isLoading ? <Typography color="muted">Loading session keys…</Typography> : null}
      {isError ? (
        <Typography className="text-danger">Couldn’t load session keys.</Typography>
      ) : null}
      <DataGrid
        aria-label={ariaLabel}
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

export type { SessionKeysTableProps, WalletSessionKeysTableProps };
