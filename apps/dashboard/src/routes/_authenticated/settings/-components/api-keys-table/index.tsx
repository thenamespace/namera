import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type {
  ApiKeyResponse,
  ListApiKeysResponse,
  ListSessionKeysForOrganizationResponse,
} from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  Typography,
  type DataGridColumn,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import {
  Activity01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  HugeiconsIcon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  TableControls,
  TableFilterControl,
  TableViewOptions,
  toTableSelection,
  type TableFilterFacet,
  type TableOption,
} from "@/components/common/table";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { DateDisplay, MetadataDisplay, StatusDisplay } from "@/components/display";
import { useApiKeys } from "@/hooks/api-key";

import { ApiKeyActions } from "./api-key-actions";
import { CreateApiKeyDialog } from "./create-api-key-dialog";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const statusOptions = ["active", "expired", "revoked"] as const;
type ApiKeyStatus = (typeof statusOptions)[number];
const defaultStatuses: ReadonlySet<ApiKeyStatus> = new Set(["active"]);
const columnIds = [
  "keyStart",
  "creator",
  "sessionKeys",
  "status",
  "expiresAt",
  "createdAt",
] as const;
const groupingOptions = [
  { id: "none", label: "No grouping" },
  { id: "status", label: "Status" },
] as const;
type Grouping = (typeof groupingOptions)[number]["id"];
type GroupRow = {
  children: ReadonlyArray<ApiKeyResponse>;
  id: string;
  kind: "group";
  status: ApiKeyStatus;
};
type Row = ApiKeyResponse | GroupRow;
const isGroup = (row: Row): row is GroupRow => "kind" in row;

const getStatus = (apiKey: ApiKeyResponse): ApiKeyStatus => {
  if (apiKey.revokedAt !== null) return "revoked";
  if (apiKey.expiresAt !== null && DateTime.toEpochMillis(apiKey.expiresAt) <= Date.now()) {
    return "expired";
  }
  return "active";
};

function ApiKeyStatusDisplay({ status }: { status: ApiKeyStatus }) {
  const presentation =
    status === "active"
      ? { icon: CheckmarkCircle02Icon, label: "Active", tone: "success" as const }
      : status === "expired"
        ? { icon: Clock01Icon, label: "Expired", tone: "muted" as const }
        : { icon: CancelCircleIcon, label: "Revoked", tone: "danger" as const };

  return (
    <StatusDisplay icon={presentation.icon} label={presentation.label} tone={presentation.tone} />
  );
}

const createColumns = (canRevoke: boolean): ReadonlyArray<DataGridColumn<Row>> => [
  {
    allowsSorting: true,
    cell: (row) =>
      isGroup(row) ? (
        <span className="flex items-center gap-2">
          <ApiKeyStatusDisplay status={row.status} />
          <span className="text-xs tabular-nums text-muted">{row.children.length}</span>
        </span>
      ) : (
        <MetadataDisplay fallbackName="Unnamed API key" metadata={row.metadata} />
      ),
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
      isGroup(row) ? null : <code className="text-xs text-muted">{row.keyStart}…</code>,
    header: "Key",
    id: "keyStart",
    minWidth: 110,
    width: 130,
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
    cell: (row) =>
      isGroup(row) ? null : (
        <Typography className="text-sm!" color="muted">
          {row.sessionKeys.length} session key{row.sessionKeys.length === 1 ? "" : "s"}
        </Typography>
      ),
    header: "Access",
    id: "sessionKeys",
    minWidth: 130,
    width: 150,
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <ApiKeyStatusDisplay status={getStatus(row)} />),
    header: "Status",
    id: "status",
    minWidth: 100,
    width: 115,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isGroup(row) ? null : row.expiresAt ? (
        <DateDisplay label="Expires" value={row.expiresAt} />
      ) : (
        <Typography className="text-sm!" color="muted">
          Never
        </Typography>
      ),
    header: "Valid until",
    id: "expiresAt",
    minWidth: 130,
    width: 150,
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <DateDisplay label="Created" value={row.createdAt} />),
    header: "Created",
    id: "createdAt",
    minWidth: 130,
    width: 150,
  },
  ...(canRevoke
    ? [
        {
          align: "end" as const,
          cell: (row: Row) => (isGroup(row) ? null : <ApiKeyActions apiKey={row} />),
          header: <span className="sr-only">Actions</span>,
          id: "actions",
          pinned: "end" as const,
          width: 48,
        },
      ]
    : []),
];

const sorters: Record<string, (left: ApiKeyResponse, right: ApiKeyResponse) => number> = {
  name: (left, right) => collator.compare(left.metadata.name, right.metadata.name),
  keyStart: (left, right) => collator.compare(left.keyStart, right.keyStart),
  creator: (left, right) => collator.compare(left.creator.user.email, right.creator.user.email),
  sessionKeys: (left, right) => left.sessionKeys.length - right.sessionKeys.length,
  status: (left, right) => collator.compare(getStatus(left), getStatus(right)),
  expiresAt: (left, right) =>
    (left.expiresAt ? DateTime.toEpochMillis(left.expiresAt) : Number.POSITIVE_INFINITY) -
    (right.expiresAt ? DateTime.toEpochMillis(right.expiresAt) : Number.POSITIVE_INFINITY),
  createdAt: (left, right) =>
    DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
};
const getRowId = (row: Row) => row.id;
const getChildren = (row: Row) => (isGroup(row) ? [...row.children] : undefined);
const fixedColumnOptions = [{ id: "name", label: "Name" }] as const;
const emptyApiKeys: ListApiKeysResponse = [];
const emptySessionKeys: ListSessionKeysForOrganizationResponse = [];

type ApiKeysTableProps = {
  canCreate: boolean;
  canRevoke: boolean;
  initialApiKeys?: ListApiKeysResponse;
  initialSessionKeys?: ListSessionKeysForOrganizationResponse;
};

export function ApiKeysTable({
  canCreate,
  canRevoke,
  initialApiKeys,
  initialSessionKeys,
}: ApiKeysTableProps) {
  const apiKeys = useApiKeys();
  const data = apiKeys.data ?? initialApiKeys ?? emptyApiKeys;
  const isInitialLoading = apiKeys.isLoading && apiKeys.data === undefined && !initialApiKeys;
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<ReadonlySet<ApiKeyStatus>>(defaultStatuses);
  const [grouping, setGrouping] = useState<Grouping>("none");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(new Set(columnIds));
  const columns = useMemo(() => createColumns(canRevoke), [canRevoke]);
  const configurableColumns = useMemo<ReadonlyArray<TableOption>>(
    () =>
      columns
        .filter((column) => column.id !== "name" && column.id !== "actions")
        .map((column) => ({ id: column.id, label: String(column.header) })),
    [columns],
  );
  const sortableColumns = useMemo<ReadonlyArray<TableOption>>(
    () =>
      columns
        .filter((column) => column.allowsSorting)
        .map((column) => ({ id: column.id, label: String(column.header) })),
    [columns],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      data.filter((apiKey) => {
        const creatorName = apiKey.creator.user.metadata.name?.toLowerCase() ?? "";
        const matchesQuery =
          normalizedQuery.length === 0 ||
          apiKey.metadata.name.toLowerCase().includes(normalizedQuery) ||
          apiKey.keyStart.toLowerCase().includes(normalizedQuery) ||
          creatorName.includes(normalizedQuery) ||
          apiKey.creator.user.email.toLowerCase().includes(normalizedQuery);
        return matchesQuery && (statuses.size === 0 || statuses.has(getStatus(apiKey)));
      }),
    [data, normalizedQuery, statuses],
  );
  const sorted = useMemo(() => {
    const sorter = sorters[String(sort.column)];
    if (!sorter) return filtered;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.toSorted((left, right) => sorter(left, right) * direction);
  }, [filtered, sort]);
  const rows = useMemo<Row[]>(() => {
    if (grouping === "none") return sorted;
    return statusOptions.flatMap((status) => {
      const children = sorted.filter((item) => getStatus(item) === status);
      return children.length === 0
        ? []
        : [{ children, id: `group:status:${status}`, kind: "group" as const, status }];
    });
  }, [grouping, sorted]);
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set(columnIds) : visibleColumns;
    return columns.filter(
      (column) =>
        column.id === "name" || column.id === "actions" || visible.has(column.id as never),
    );
  }, [columns, visibleColumns]);
  const facets = useMemo<ReadonlyArray<TableFilterFacet>>(
    () => [
      {
        id: "status",
        label: "Status",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Activity01Icon} />,
        defaultSelectedKeys: defaultStatuses,
        selectedKeys: statuses,
        options: statusOptions.map((status) => ({
          id: status,
          label: `${status.charAt(0).toUpperCase()}${status.slice(1)}`,
          content: <ApiKeyStatusDisplay status={status} />,
          count: data.filter((item) => getStatus(item) === status).length,
        })),
        onSelectionChange: (keys) => setStatuses(toTableSelection(keys, statusOptions)),
      },
    ],
    [data, statuses],
  );
  const renderEmptyState = useEventCallback(() =>
    data.length === 0 ? "No API keys yet." : "No API keys match these filters.",
  );
  const resetView = useEventCallback(() => {
    setGrouping("none");
    setSort({ column: "createdAt", direction: "descending" });
    setVisibleColumns(new Set(columnIds));
  });
  const clearFilters = useEventCallback(() => setStatuses(defaultStatuses));
  const handleGroupingChange = useEventCallback((value: string) => {
    setGrouping(value as Grouping);
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <SearchField
          aria-label="Filter API keys"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter API keys…" />
            <SearchField.ClearButton aria-label="Clear API key search" />
          </SearchField.Group>
        </SearchField>
        <div className="ml-auto flex items-center gap-2">
          <TableControls>
            <TableFilterControl
              ariaLabel="Apply API key filters"
              facets={facets}
              onClear={clearFilters}
            />
            <TableViewOptions
              ariaLabel="Configure API key table view"
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
          {canCreate ? (
            <CreateApiKeyDialog initialSessionKeys={initialSessionKeys ?? emptySessionKeys} />
          ) : null}
        </div>
      </div>
      {apiKeys.isError ? (
        <DataError
          compact
          label="API keys"
          onRetry={apiKeys.refetch}
          isRetrying={apiKeys.isFetching}
        />
      ) : null}
      {isInitialLoading ? (
        <DataLoading className="min-h-64" label="Loading API keys" />
      ) : (
        <DataGrid
          aria-label="Organization API keys"
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
      )}
    </div>
  );
}
