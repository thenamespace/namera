import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type { ListWalletsResponse, WalletResponse } from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  Typography,
  type DataGridColumn,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import {
  DateDisplay,
  EvmAddressDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  WalletImplementationDisplay,
  WalletProtectionDisplay,
  WalletStatusDisplay,
} from "@/components/display";
import { useWallets } from "@/hooks/wallet";

import { AccountActions } from "./account-actions";
import {
  AccountsTableControls,
  type AccountFilters,
  type AccountGrouping,
  type ColumnOption,
} from "./accounts-table-controls";

const accountCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const defaultSort: DataGridSortDescriptor = {
  column: "createdAt",
  direction: "descending",
};

const defaultFilters: AccountFilters = {
  status: "all",
  implementation: "all",
  protectionLevel: "all",
};

const columnIds = [
  "status",
  "namespace",
  "address",
  "implementation",
  "protectionLevel",
  "createdAt",
] as const;

type ConfigurableColumnId = (typeof columnIds)[number];

type AccountGroupRow = {
  kind: "group";
  id: string;
  label: string;
  accounts: ReadonlyArray<WalletResponse>;
};

type AccountTableRow = WalletResponse | AccountGroupRow;

const isAccountGroup = (row: AccountTableRow): row is AccountGroupRow => "kind" in row;

const accountSorters: Record<
  ConfigurableColumnId | "name",
  (left: WalletResponse, right: WalletResponse) => number
> = {
  name: (left, right) => accountCollator.compare(left.metadata.name, right.metadata.name),
  status: (left, right) => accountCollator.compare(left.status, right.status),
  namespace: (left, right) => accountCollator.compare(left.namespace, right.namespace),
  address: (left, right) => accountCollator.compare(left.address, right.address),
  implementation: (left, right) =>
    accountCollator.compare(left.implementation, right.implementation),
  protectionLevel: (left, right) =>
    accountCollator.compare(left.protectionLevel, right.protectionLevel),
  createdAt: (left, right) =>
    DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
};

const columns: ReadonlyArray<DataGridColumn<AccountTableRow>> = [
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (row) =>
      isAccountGroup(row) ? (
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <span className="truncate">{row.label}</span>
          <span className="text-xs font-normal tabular-nums text-muted">{row.accounts.length}</span>
        </span>
      ) : (
        <MetadataDisplay fallbackName="Unnamed account" metadata={row.metadata} />
      ),
    header: "Name",
    id: "name",
    isRowHeader: true,
    minWidth: 160,
    pinned: "start",
    width: "20%",
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (row) => (isAccountGroup(row) ? null : <WalletStatusDisplay status={row.status} />),
    header: "Status",
    id: "status",
    minWidth: 90,
    width: "11%",
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (row) => (isAccountGroup(row) ? null : <NamespaceDisplay namespace={row.namespace} />),
    header: "Namespace",
    id: "namespace",
    minWidth: 100,
    width: "12%",
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (row) => (isAccountGroup(row) ? null : <EvmAddressDisplay address={row.address} />),
    header: "Address",
    id: "address",
    minWidth: 150,
    width: "18%",
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (row) =>
      isAccountGroup(row) ? null : (
        <WalletImplementationDisplay implementation={row.implementation} />
      ),
    header: "Implementation",
    id: "implementation",
    minWidth: 120,
    width: "15%",
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (row) =>
      isAccountGroup(row) ? null : (
        <WalletProtectionDisplay protectionLevel={row.protectionLevel} />
      ),
    header: "Protection",
    id: "protectionLevel",
    minWidth: 100,
    width: "12%",
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (row) =>
      isAccountGroup(row) ? null : <DateDisplay label="Created" value={row.createdAt} />,
    header: "Created",
    id: "createdAt",
    minWidth: 105,
    width: "11%",
  },
  {
    align: "center",
    allowsResizing: false,
    allowsSorting: false,
    cell: (row) => (isAccountGroup(row) ? null : <AccountActions account={row} />),
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

const configurableColumns: ReadonlyArray<ColumnOption> = columns
  .filter((column) => columnIds.includes(column.id as ConfigurableColumnId))
  .map((column) => ({ id: column.id, label: String(column.header) }));

const sortableColumns: ReadonlyArray<ColumnOption> = columns
  .filter((column) => column.allowsSorting)
  .map((column) => ({ id: column.id, label: String(column.header) }));

const getAccountRowId = (row: AccountTableRow) => row.id;
const getAccountChildren = (row: AccountTableRow) =>
  isAccountGroup(row) ? [...row.accounts] : undefined;

const formatGroupLabel = (grouping: AccountGrouping, value: string) => {
  if (grouping === "protectionLevel") return value.toUpperCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
};

function groupAccounts(
  accounts: ReadonlyArray<WalletResponse>,
  grouping: Exclude<AccountGrouping, "none">,
): AccountGroupRow[] {
  const groups = new Map<string, WalletResponse[]>();
  for (const account of accounts) {
    const value = account[grouping];
    const group = groups.get(value);
    if (group) group.push(account);
    else groups.set(value, [account]);
  }

  return [...groups.entries()].map(([value, groupedAccounts]) => ({
    kind: "group",
    id: `group:${grouping}:${value}`,
    label: formatGroupLabel(grouping, value),
    accounts: groupedAccounts,
  }));
}

type AccountsTableProps = {
  initialAccounts: ListWalletsResponse;
};

export function AccountsTable({ initialAccounts }: AccountsTableProps) {
  const accounts = useWallets();
  const accountData = accounts.data ?? initialAccounts;
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AccountFilters>(defaultFilters);
  const [grouping, setGrouping] = useState<AccountGrouping>("none");
  const [sort, setSort] = useState<DataGridSortDescriptor>(defaultSort);
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(new Set(columnIds));

  const normalizedQuery = query.trim().toLowerCase();
  const filteredAccounts = useMemo(
    () =>
      accountData.filter((account) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          account.metadata.name.toLowerCase().includes(normalizedQuery) ||
          account.address.toLowerCase().includes(normalizedQuery) ||
          account.id.toLowerCase().includes(normalizedQuery);
        const matchesStatus = filters.status === "all" || account.status === filters.status;
        const matchesImplementation =
          filters.implementation === "all" || account.implementation === filters.implementation;
        const matchesProtection =
          filters.protectionLevel === "all" || account.protectionLevel === filters.protectionLevel;

        return matchesQuery && matchesStatus && matchesImplementation && matchesProtection;
      }),
    [accountData, filters, normalizedQuery],
  );
  const sortedAccounts = useMemo(() => {
    const sortFn = accountSorters[String(sort.column) as keyof typeof accountSorters];
    if (!sortFn) return filteredAccounts;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filteredAccounts.toSorted((left, right) => sortFn(left, right) * direction);
  }, [filteredAccounts, sort]);
  const tableRows = useMemo<AccountTableRow[]>(
    () => (grouping === "none" ? sortedAccounts : groupAccounts(sortedAccounts, grouping)),
    [grouping, sortedAccounts],
  );
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set<string>(columnIds) : new Set(visibleColumns);
    return columns.filter(
      (column) => column.id === "name" || column.id === "actions" || visible.has(column.id),
    );
  }, [visibleColumns]);
  const hasFilters =
    normalizedQuery.length > 0 || Object.values(filters).some((value) => value !== "all");
  const renderEmptyState = useEventCallback(() =>
    hasFilters ? "No accounts match these filters." : "No accounts yet.",
  );
  const resetView = useEventCallback(() => {
    setGrouping("none");
    setSort(defaultSort);
    setVisibleColumns(new Set(columnIds));
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <SearchField
          aria-label="Filter accounts by name, address, or ID"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter accounts…" />
            <SearchField.ClearButton aria-label="Clear account search" />
          </SearchField.Group>
        </SearchField>

        <div className="ml-auto">
          <AccountsTableControls
            columnOptions={configurableColumns}
            filters={filters}
            grouping={grouping}
            sort={sort}
            sortableColumns={sortableColumns}
            visibleColumns={visibleColumns}
            onFiltersChange={setFilters}
            onGroupingChange={setGrouping}
            onResetView={resetView}
            onSortChange={setSort}
            onVisibleColumnsChange={setVisibleColumns}
          />
        </div>
      </div>

      {accounts.isLoading ? <Typography color="muted">Loading accounts…</Typography> : null}
      {accounts.isError ? (
        <Typography className="text-danger">Couldn’t load accounts.</Typography>
      ) : null}

      <DataGrid
        allowsColumnResize
        aria-label="Organization accounts"
        columns={displayedColumns}
        data={tableRows}
        defaultExpandedKeys="all"
        getRowId={getAccountRowId}
        key={grouping}
        renderEmptyState={renderEmptyState}
        sortDescriptor={sort}
        variant="secondary"
        onSortChange={setSort}
        {...(grouping === "none" ? {} : { getChildren: getAccountChildren })}
      />
    </div>
  );
}

export type { AccountsTableProps };
