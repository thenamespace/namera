import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type {
  ListSessionKeysForOrganizationResponse,
  SessionKeyResponse,
} from "@namera-ai/protocol/dto";
import {
  Button,
  DataGrid,
  Dropdown,
  SearchField,
  Typography,
  type DataGridColumn,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import {
  HugeiconsIcon,
  LayoutThreeColumnIcon,
  SlidersHorizontalIcon,
  Sorting01Icon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  DateDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  SessionKeyStatusDisplay,
} from "@/components/display";
import { useSessionKeys } from "@/hooks/session-key";

const sessionKeyCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const columnIds = ["name", "status", "account", "creator", "namespace", "createdAt"] as const;

const columns: DataGridColumn<SessionKeyResponse>[] = [
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (sessionKey) => (
      <MetadataDisplay fallbackName="Unnamed session key" metadata={sessionKey.metadata} />
    ),
    header: "Name",
    id: "name",
    isRowHeader: true,
    minWidth: 210,
    pinned: "start",
    sortFn: (left, right) => sessionKeyCollator.compare(left.metadata.name, right.metadata.name),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (sessionKey) => <SessionKeyStatusDisplay status={sessionKey.status} />,
    header: "Status",
    id: "status",
    minWidth: 120,
    sortFn: (left, right) => sessionKeyCollator.compare(left.status, right.status),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (sessionKey) => (
      <MetadataDisplay fallbackName="Unnamed account" metadata={sessionKey.wallet.metadata} />
    ),
    header: "Account",
    id: "account",
    minWidth: 200,
    sortFn: (left, right) =>
      sessionKeyCollator.compare(left.wallet.metadata.name, right.wallet.metadata.name),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (sessionKey) => (
      <MetadataDisplay
        fallbackName={sessionKey.creator.user.email}
        metadata={sessionKey.creator.user.metadata}
      />
    ),
    header: "Created by",
    id: "creator",
    minWidth: 180,
    sortFn: (left, right) =>
      sessionKeyCollator.compare(
        left.creator.user.metadata.name ?? left.creator.user.email,
        right.creator.user.metadata.name ?? right.creator.user.email,
      ),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (sessionKey) => <NamespaceDisplay namespace={sessionKey.namespace} />,
    header: "Namespace",
    id: "namespace",
    minWidth: 140,
    sortFn: (left, right) => sessionKeyCollator.compare(left.namespace, right.namespace),
  },
  {
    allowsResizing: true,
    allowsSorting: true,
    cell: (sessionKey) => <DateDisplay label="Created" value={sessionKey.createdAt} />,
    header: "Created",
    id: "createdAt",
    minWidth: 140,
    sortFn: (left, right) =>
      DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
  },
];

const sortableColumns = columns.filter((column) => column.allowsSorting);
const configurableColumns = columns;
const sessionKeyStatuses = ["all", "active", "revoked"] as const;
const getSessionKeyId = (sessionKey: SessionKeyResponse) => sessionKey.id;

type SessionKeysTableProps = {
  initialSessionKeys: ListSessionKeysForOrganizationResponse;
};

export function SessionKeysTable({ initialSessionKeys }: SessionKeysTableProps) {
  const sessionKeys = useSessionKeys();
  const sessionKeyData = sessionKeys.data ?? initialSessionKeys;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | SessionKeyResponse["status"]>("all");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(new Set(columnIds));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSessionKeys = useMemo(
    () =>
      sessionKeyData.filter((sessionKey) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          sessionKey.metadata.name.toLowerCase().includes(normalizedQuery) ||
          sessionKey.id.toLowerCase().includes(normalizedQuery) ||
          sessionKey.wallet.metadata.name.toLowerCase().includes(normalizedQuery) ||
          sessionKey.wallet.address.toLowerCase().includes(normalizedQuery) ||
          sessionKey.creator.user.metadata.name?.toLowerCase().includes(normalizedQuery) === true ||
          sessionKey.creator.user.email.toLowerCase().includes(normalizedQuery);
        const matchesStatus = status === "all" || sessionKey.status === status;
        return matchesQuery && matchesStatus;
      }),
    [normalizedQuery, sessionKeyData, status],
  );
  const sortedSessionKeys = useMemo(() => {
    const sortFn = columns.find((column) => column.id === sort.column)?.sortFn;
    if (!sortFn) return filteredSessionKeys;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filteredSessionKeys.toSorted((left, right) => sortFn(left, right) * direction);
  }, [filteredSessionKeys, sort]);
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set<string>(columnIds) : visibleColumns;
    return columns.filter((column) => visible.has(column.id));
  }, [visibleColumns]);
  const hasFilters = normalizedQuery.length > 0 || status !== "all";
  const statusSelection = useMemo(() => new Set([status]), [status]);
  const sortSelection = useMemo(() => new Set([String(sort.column)]), [sort.column]);
  const handleStatusChange = useEventCallback((keys: DataGridSelection) => {
    if (keys === "all") return;
    const nextStatus = [...keys][0];
    if (typeof nextStatus === "string") setStatus(nextStatus as typeof status);
  });
  const handleSortColumnChange = useEventCallback((keys: DataGridSelection) => {
    if (keys === "all") return;
    const column = [...keys][0];
    if (column !== undefined) setSort((current) => ({ ...current, column }));
  });
  const toggleSortDirection = useEventCallback(() => {
    setSort((current) => ({
      ...current,
      direction: current.direction === "ascending" ? "descending" : "ascending",
    }));
  });
  const renderEmptyState = useEventCallback(() =>
    hasFilters ? "No session keys match these filters." : "No session keys yet.",
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <SearchField
          aria-label="Filter session keys by name, account, creator, address, or ID"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter session keys..." />
            <SearchField.ClearButton aria-label="Clear session key filter" />
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
                {sessionKeyStatuses.map((value) => (
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

      {sessionKeys.isLoading ? <Typography color="muted">Loading session keys…</Typography> : null}
      {sessionKeys.isError ? (
        <Typography className="text-danger">Couldn’t load session keys.</Typography>
      ) : null}

      <DataGrid
        allowsColumnResize
        aria-label="Organization session keys"
        columns={displayedColumns}
        data={sortedSessionKeys}
        getRowId={getSessionKeyId}
        renderEmptyState={renderEmptyState}
        sortDescriptor={sort}
        variant="secondary"
        onSortChange={setSort}
      />
    </div>
  );
}

export type { SessionKeysTableProps };
