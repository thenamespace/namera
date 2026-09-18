import { useMemo, useState } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import { DateTime } from "effect";

import type { ListWalletsResponse, WalletResponse } from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  type DataGridColumn,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import { Wallet01Icon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import type { TableOption } from "@/components/common/table";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import {
  DateDisplay,
  EvmAddressDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  WalletImplementationDisplay,
  WalletOwnerDisplay,
  WalletStatusDisplay,
} from "@/components/display";
import { ResourceEmptyState } from "@/components/resource-empty-state";
import { useWallets } from "@/hooks/wallet";

import { AccountActions } from "./actions";
import { AccountsTableControls, type AccountGrouping } from "./controls";
import {
  createDefaultAccountFilters,
  type AccountFilterCounts,
  type AccountFilters,
} from "./filter-menu";

const accountCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
const emptyAccounts: ListWalletsResponse = [];

const defaultSort: DataGridSortDescriptor = {
  column: "createdAt",
  direction: "descending",
};

const columnIds = [
  "namespace",
  "address",
  "implementation",
  "status",
  "ownership",
  "createdAt",
] as const;

const defaultColumnIds = columnIds.filter((id) => id !== "ownership");

type ConfigurableColumnId = (typeof columnIds)[number];

type AccountGroupRow = {
  kind: "group";
  id: string;
  grouping: Exclude<AccountGrouping, "none">;
  value: string;
  accounts: ReadonlyArray<WalletResponse>;
};

type AccountTableRow = WalletResponse | AccountGroupRow;

const isAccountGroup = (row: AccountTableRow): row is AccountGroupRow => "kind" in row;

function AccountNameCell({ account }: { account: WalletResponse }) {
  const accountParams = useMemo(() => ({ accountId: account.id }), [account.id]);

  return (
    <Link
      className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      params={accountParams}
      to="/account/$accountId/overview"
    >
      <MetadataDisplay fallbackName="Unnamed account" metadata={account.metadata} />
    </Link>
  );
}

function AccountGroupLabel({ group }: { group: AccountGroupRow }) {
  const display = (() => {
    if (group.grouping === "status") {
      return <WalletStatusDisplay status={group.value as WalletResponse["status"]} />;
    }
    return <WalletOwnerDisplay custody={group.value as "local" | "namera-managed"} />;
  })();

  return (
    <span className="flex min-w-0 items-center gap-2" data-account-group>
      {display}
      <span className="text-xs tabular-nums text-muted">{group.accounts.length}</span>
    </span>
  );
}

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
  ownership: (left, right) => accountCollator.compare(left.owner.custody, right.owner.custody),
  createdAt: (left, right) =>
    DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
};

const columns: ReadonlyArray<DataGridColumn<AccountTableRow>> = [
  {
    allowsSorting: true,
    cell: (row) =>
      isAccountGroup(row) ? <AccountGroupLabel group={row} /> : <AccountNameCell account={row} />,
    header: "Name",
    id: "name",
    isRowHeader: true,
    minWidth: 160,
    pinned: "start",
    width: "1fr",
  },
  {
    allowsSorting: true,
    cell: (row) => (isAccountGroup(row) ? null : <NamespaceDisplay namespace={row.namespace} />),
    header: "Namespace",
    id: "namespace",
    minWidth: 160,
    width: 160,
  },
  {
    allowsSorting: true,
    cell: (row) => (isAccountGroup(row) ? null : <EvmAddressDisplay address={row.address} />),
    header: "Address",
    id: "address",
    minWidth: 190,
    width: 220,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isAccountGroup(row) ? null : (
        <WalletImplementationDisplay implementation={row.implementation} />
      ),
    header: "Implementation",
    id: "implementation",
    minWidth: 125,
    width: 140,
  },
  {
    allowsSorting: true,
    cell: (row) => (isAccountGroup(row) ? null : <WalletStatusDisplay status={row.status} />),
    header: "Status",
    id: "status",
    minWidth: 90,
    width: 105,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isAccountGroup(row) ? null : (
        <WalletOwnerDisplay
          custody={row.owner.custody}
          protectionLevel={
            row.owner.custody === "namera-managed" ? row.owner.protectionLevel : undefined
          }
        />
      ),
    header: "Ownership",
    id: "ownership",
    minWidth: 190,
    width: 210,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isAccountGroup(row) ? null : <DateDisplay label="Created" value={row.createdAt} />,
    header: "Created",
    id: "createdAt",
    minWidth: 160,
    width: 160,
  },
  {
    align: "center",
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

const configurableColumns: ReadonlyArray<TableOption> = columns
  .filter((column) => columnIds.includes(column.id as ConfigurableColumnId))
  .map((column) => ({ id: column.id, label: String(column.header) }));

const sortableColumns: ReadonlyArray<TableOption> = columns
  .filter((column) => column.allowsSorting)
  .map((column) => ({ id: column.id, label: String(column.header) }));

const getAccountRowId = (row: AccountTableRow) => row.id;
const getAccountChildren = (row: AccountTableRow) =>
  isAccountGroup(row) ? [...row.accounts] : undefined;

function groupAccounts(
  accounts: ReadonlyArray<WalletResponse>,
  grouping: Exclude<AccountGrouping, "none">,
): AccountGroupRow[] {
  const groups = new Map<string, WalletResponse[]>();
  for (const account of accounts) {
    const value = grouping === "ownership" ? account.owner.custody : account.status;
    const group = groups.get(value);
    if (group) group.push(account);
    else groups.set(value, [account]);
  }

  return [...groups.entries()].map(([value, groupedAccounts]) => ({
    kind: "group",
    id: `group:${grouping}:${value}`,
    grouping,
    value,
    accounts: groupedAccounts,
  }));
}

type AccountsTableProps = {
  initialAccounts?: ListWalletsResponse;
};

export function AccountsTable({ initialAccounts }: AccountsTableProps) {
  const accounts = useWallets();
  const accountData = accounts.data ?? initialAccounts ?? emptyAccounts;
  const isInitialLoading = accounts.isLoading && accounts.data === undefined && !initialAccounts;
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AccountFilters>(createDefaultAccountFilters);
  const [grouping, setGrouping] = useState<AccountGrouping>("none");
  const [sort, setSort] = useState<DataGridSortDescriptor>(defaultSort);
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(
    new Set(defaultColumnIds),
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredAccounts = useMemo(
    () =>
      accountData.filter((account) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          account.metadata.name.toLowerCase().includes(normalizedQuery) ||
          account.address.toLowerCase().includes(normalizedQuery) ||
          account.id.toLowerCase().includes(normalizedQuery);
        const matchesStatus = filters.status.size === 0 || filters.status.has(account.status);
        const matchesOwnership =
          filters.ownership.size === 0 || filters.ownership.has(account.owner.custody);

        return matchesQuery && matchesStatus && matchesOwnership;
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
  const filterCounts = useMemo<AccountFilterCounts>(() => {
    const counts: AccountFilterCounts = {
      status: { active: 0, archived: 0, frozen: 0 },
      ownership: { local: 0, "namera-managed": 0 },
    };

    for (const account of accountData) {
      counts.status[account.status] += 1;
      counts.ownership[account.owner.custody] += 1;
    }

    return counts;
  }, [accountData]);
  const navigate = useNavigate();
  const createAccount = useEventCallback(() => {
    void navigate({ to: "/accounts/new" });
  });
  const renderEmptyState = useEventCallback(() =>
    accountData.length === 0 ? (
      <ResourceEmptyState
        actionLabel="Create account"
        description="Create a smart account for your agents to transact through, with the limits you set."
        icon={Wallet01Icon}
        onCreate={createAccount}
        title="No accounts yet"
      />
    ) : (
      "No accounts match these filters."
    ),
  );
  const resetView = useEventCallback(() => {
    setGrouping("none");
    setSort(defaultSort);
    setVisibleColumns(new Set(defaultColumnIds));
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
            filterCounts={filterCounts}
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

      {accounts.isError ? (
        <DataError
          compact
          label="accounts"
          onRetry={accounts.refetch}
          isRetrying={accounts.isFetching}
        />
      ) : null}

      {isInitialLoading ? (
        <DataLoading className="min-h-64" label="Loading accounts" />
      ) : (
        <DataGrid
          aria-label="Organization accounts"
          className="accounts-data-grid"
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
      )}
    </div>
  );
}

export type { AccountsTableProps };
