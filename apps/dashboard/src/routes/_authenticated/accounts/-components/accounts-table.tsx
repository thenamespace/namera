import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type { ListWalletsResponse, WalletResponse } from "@namera-ai/protocol/dto";
import {
  Button,
  DataGrid,
  Dropdown,
  SearchField,
  Typography,
  toast,
  type DataGridColumn,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import {
  Copy01Icon,
  HugeiconsIcon,
  LayoutThreeColumnIcon,
  MoreVerticalIcon,
  SlidersHorizontalIcon,
  Sorting01Icon,
} from "@namera-ai/ui/icons";
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

const accountCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const columnIds = [
  "name",
  "status",
  "namespace",
  "address",
  "implementation",
  "protectionLevel",
  "createdAt",
] as const;

const columns: DataGridColumn<WalletResponse>[] = [
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (account) => (
      <MetadataDisplay fallbackName="Unnamed account" metadata={account.metadata} />
    ),
    header: "Name",
    id: "name",
    isRowHeader: true,
    minWidth: 200,
    pinned: "start",
    sortFn: (left, right) => accountCollator.compare(left.metadata.name, right.metadata.name),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (account) => <WalletStatusDisplay status={account.status} />,
    header: "Status",
    id: "status",
    minWidth: 120,
    sortFn: (left, right) => accountCollator.compare(left.status, right.status),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (account) => <NamespaceDisplay namespace={account.namespace} />,
    header: "Namespace",
    id: "namespace",
    minWidth: 140,
    sortFn: (left, right) => accountCollator.compare(left.namespace, right.namespace),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (account) => <EvmAddressDisplay address={account.address} />,
    header: "Address",
    id: "address",
    minWidth: 180,
    sortFn: (left, right) => accountCollator.compare(left.address, right.address),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (account) => <WalletImplementationDisplay implementation={account.implementation} />,
    header: "Implementation",
    id: "implementation",
    minWidth: 160,
    sortFn: (left, right) => accountCollator.compare(left.implementation, right.implementation),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (account) => <WalletProtectionDisplay protectionLevel={account.protectionLevel} />,
    header: "Protection",
    id: "protectionLevel",
    minWidth: 130,
    sortFn: (left, right) => accountCollator.compare(left.protectionLevel, right.protectionLevel),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (account) => <DateDisplay label="Created" value={account.createdAt} />,
    header: "Created",
    id: "createdAt",
    minWidth: 140,
    sortFn: (left, right) =>
      DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
  },
  {
    align: "end",
    cell: (account) => <AccountActions accountId={account.id} />,
    header: "",
    id: "actions",
    pinned: "end",
    width: 48,
  },
];

const sortableColumns = columns.filter((column) => column.allowsSorting);
const configurableColumns = columns.filter((column) => column.id !== "actions");
const walletStatuses = ["all", "active", "frozen", "archived"] as const;

function AccountActions({ accountId }: { accountId: WalletResponse["id"] }) {
  const copyId = useEventCallback(() => {
    void navigator.clipboard.writeText(accountId).then(
      () => toast.success("Account ID copied"),
      () => toast.danger("Couldn’t copy account ID"),
    );
  });
  const handleAction = useEventCallback((key: string | number) => {
    if (key === "copy-id") copyId();
  });

  return (
    <Dropdown>
      <Button isIconOnly aria-label="Account actions" size="sm" variant="tertiary">
        <HugeiconsIcon icon={MoreVerticalIcon} />
      </Button>
      <Dropdown.Popover className="min-w-44">
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Item id="copy-id" textValue="Copy account ID">
            <HugeiconsIcon icon={Copy01Icon} />
            Copy account ID
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

const getAccountId = (account: WalletResponse) => account.id;

type AccountsTableProps = {
  initialAccounts: ListWalletsResponse;
};

export function AccountsTable({ initialAccounts }: AccountsTableProps) {
  const accounts = useWallets();
  const accountData = accounts.data ?? initialAccounts;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | WalletResponse["status"]>("all");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
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
        const matchesStatus = status === "all" || account.status === status;
        return matchesQuery && matchesStatus;
      }),
    [accountData, normalizedQuery, status],
  );
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set<string>(columnIds) : visibleColumns;
    return columns.filter((column) => column.id === "actions" || visible.has(column.id));
  }, [visibleColumns]);
  const hasFilters = normalizedQuery.length > 0 || status !== "all";
  const statusSelection = useMemo(() => new Set([status]), [status]);
  const sortSelection = useMemo(() => new Set([String(sort.column)]), [sort.column]);
  const handleStatusChange = useEventCallback((keys: DataGridSelection) => {
    if (keys === "all") return;
    const nextStatus = [...keys][0];
    if (typeof nextStatus === "string") {
      setStatus(nextStatus as typeof status);
    }
  });
  const handleSortColumnChange = useEventCallback((keys: DataGridSelection) => {
    if (keys === "all") return;
    const column = [...keys][0];
    if (column !== undefined) {
      setSort((current) => ({ ...current, column }));
    }
  });
  const toggleSortDirection = useEventCallback(() => {
    setSort((current) => ({
      ...current,
      direction: current.direction === "ascending" ? "descending" : "ascending",
    }));
  });
  const renderEmptyState = useEventCallback(() =>
    hasFilters ? "No accounts match these filters." : "No accounts yet.",
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <SearchField
          aria-label="Filter accounts by name, address, or ID"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter accounts..." />
            <SearchField.ClearButton aria-label="Clear account filter" />
          </SearchField.Group>
        </SearchField>

        <div className="flex flex-wrap items-center gap-2">
          <Dropdown>
            <Button size="sm" variant="secondary">
              <HugeiconsIcon icon={SlidersHorizontalIcon} />
              {status === "all" ? "All statuses" : status}
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                selectedKeys={statusSelection}
                selectionMode="single"
                onSelectionChange={handleStatusChange}
              >
                {walletStatuses.map((value) => (
                  <Dropdown.Item id={value} key={value} textValue={value}>
                    <span className="capitalize">{value === "all" ? "All statuses" : value}</span>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          <Dropdown>
            <Button size="sm" variant="secondary">
              <HugeiconsIcon icon={Sorting01Icon} />
              Sort
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                selectedKeys={sortSelection}
                selectionMode="single"
                onSelectionChange={handleSortColumnChange}
              >
                {sortableColumns.map((column) => (
                  <Dropdown.Item id={column.id} key={column.id} textValue={String(column.header)}>
                    <span>{String(column.header)}</span>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          <Button
            aria-label={`Sort ${sort.direction === "ascending" ? "descending" : "ascending"}`}
            size="sm"
            variant="secondary"
            onPress={toggleSortDirection}
          >
            {sort.direction === "ascending" ? "Ascending" : "Descending"}
          </Button>

          <Dropdown>
            <Button size="sm" variant="secondary">
              <HugeiconsIcon icon={LayoutThreeColumnIcon} />
              Columns
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                disallowEmptySelection
                selectedKeys={visibleColumns}
                selectionMode="multiple"
                onSelectionChange={setVisibleColumns}
              >
                {configurableColumns.map((column) => (
                  <Dropdown.Item id={column.id} key={column.id} textValue={String(column.header)}>
                    <span>{String(column.header)}</span>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
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
        contentClassName="min-w-[1120px]"
        data={filteredAccounts}
        getRowId={getAccountId}
        renderEmptyState={renderEmptyState}
        sortDescriptor={sort}
        variant="secondary"
        onSortChange={setSort}
      />
    </div>
  );
}

export type { AccountsTableProps };
