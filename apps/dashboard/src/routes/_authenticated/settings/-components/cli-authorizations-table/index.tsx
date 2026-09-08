// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type {
  ListOAuthAuthorizationsResponse,
  OAuthAuthorizationResponse,
} from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  Typography,
  type DataGridColumn,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import { Activity01Icon, HugeiconsIcon, TerminalIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  TableControls,
  TableFilterControl,
  toTableSelection,
  type TableFilterFacet,
} from "@/components/common/table";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import {
  DateDisplay,
  MetadataDisplay,
  OAuthAuthorizationStatusDisplay,
} from "@/components/display";
import { useCliAuthorizations } from "@/hooks/auth";

import { CliAuthorizationActions } from "./actions";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const statusOptions = ["active", "revoked"] as const;
type AuthorizationStatus = (typeof statusOptions)[number];
const defaultStatuses: ReadonlySet<AuthorizationStatus> = new Set(["active"]);

const getRowId = (authorization: OAuthAuthorizationResponse) => authorization.id;
const getDeviceName = (authorization: OAuthAuthorizationResponse) =>
  authorization.metadata.type === "cli"
    ? authorization.metadata.deviceName
    : authorization.client.clientName;
const getEnvironment = (authorization: OAuthAuthorizationResponse) =>
  authorization.metadata.type === "cli"
    ? `${authorization.metadata.platform} · CLI ${authorization.metadata.cliVersion}`
    : authorization.client.clientName;

const createColumns = (canRevoke: boolean): DataGridColumn<OAuthAuthorizationResponse>[] => [
  {
    allowsSorting: true,
    cell: (authorization) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="bg-surface-tertiary flex size-6 shrink-0 items-center justify-center rounded-md">
          <HugeiconsIcon className="size-3.5" icon={TerminalIcon} />
        </span>
        <div className="min-w-0">
          <Typography className="truncate text-sm! leading-[1.2]" weight="normal">
            {getDeviceName(authorization)}
          </Typography>
          <Typography className="truncate text-xs! leading-[1.2]" color="muted">
            {getEnvironment(authorization)}
          </Typography>
        </div>
      </div>
    ),
    header: "Device",
    id: "device",
    isRowHeader: true,
    minWidth: 190,
    pinned: "start",
    width: "1fr",
  },
  {
    allowsSorting: true,
    cell: (authorization) => (
      <Typography className="text-sm!" color="muted">
        {authorization.sessionKeys.length} session key
        {authorization.sessionKeys.length === 1 ? "" : "s"}
      </Typography>
    ),
    header: "Access",
    id: "access",
    minWidth: 120,
    width: 145,
  },
  {
    allowsSorting: true,
    cell: (authorization) => (
      <MetadataDisplay
        fallbackName={authorization.authorizedBy.user.email}
        metadata={authorization.authorizedBy.user.metadata}
      />
    ),
    header: "Authorized by",
    id: "authorizedBy",
    minWidth: 160,
    width: 190,
  },
  {
    allowsSorting: true,
    cell: (authorization) => <OAuthAuthorizationStatusDisplay status={authorization.status} />,
    header: "Status",
    id: "status",
    minWidth: 100,
    width: 115,
  },
  {
    allowsSorting: true,
    cell: (authorization) =>
      authorization.lastUsedAt === null ? (
        <Typography className="text-sm!" color="muted">
          Never
        </Typography>
      ) : (
        <DateDisplay label="Last used" value={authorization.lastUsedAt} />
      ),
    header: "Last used",
    id: "lastUsedAt",
    minWidth: 130,
    width: 150,
  },
  {
    allowsSorting: true,
    cell: (authorization) => <DateDisplay label="Created" value={authorization.createdAt} />,
    header: "Created",
    id: "createdAt",
    minWidth: 130,
    width: 150,
  },
  {
    align: "end",
    cell: (authorization) => (
      <CliAuthorizationActions authorization={authorization} canRevoke={canRevoke} />
    ),
    header: <span className="sr-only">Actions</span>,
    id: "actions",
    pinned: "end",
    width: 48,
  },
];

const sorters: Record<
  string,
  (left: OAuthAuthorizationResponse, right: OAuthAuthorizationResponse) => number
> = {
  device: (left, right) => collator.compare(getDeviceName(left), getDeviceName(right)),
  access: (left, right) => left.sessionKeys.length - right.sessionKeys.length,
  authorizedBy: (left, right) =>
    collator.compare(
      left.authorizedBy.user.metadata.name ?? left.authorizedBy.user.email,
      right.authorizedBy.user.metadata.name ?? right.authorizedBy.user.email,
    ),
  status: (left, right) => collator.compare(left.status, right.status),
  lastUsedAt: (left, right) =>
    (left.lastUsedAt ? DateTime.toEpochMillis(left.lastUsedAt) : 0) -
    (right.lastUsedAt ? DateTime.toEpochMillis(right.lastUsedAt) : 0),
  createdAt: (left, right) =>
    DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
};

type CliAuthorizationsTableProps = {
  canRevoke: boolean;
  initialAuthorizations?: ListOAuthAuthorizationsResponse;
};
const emptyAuthorizations: ListOAuthAuthorizationsResponse = [];

export function CliAuthorizationsTable({
  canRevoke,
  initialAuthorizations,
}: CliAuthorizationsTableProps) {
  const authorizations = useCliAuthorizations();
  const data = authorizations.data ?? initialAuthorizations ?? emptyAuthorizations;
  const isInitialLoading =
    authorizations.isLoading && authorizations.data === undefined && !initialAuthorizations;
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<ReadonlySet<AuthorizationStatus>>(defaultStatuses);
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const columns = useMemo(() => createColumns(canRevoke), [canRevoke]);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      data.filter((authorization) => {
        const metadata = authorization.metadata;
        const authorizerName = authorization.authorizedBy.user.metadata.name?.toLowerCase() ?? "";
        const matchesQuery =
          normalizedQuery.length === 0 ||
          getDeviceName(authorization).toLowerCase().includes(normalizedQuery) ||
          authorization.client.clientName.toLowerCase().includes(normalizedQuery) ||
          (metadata.type === "cli" &&
            (metadata.platform.toLowerCase().includes(normalizedQuery) ||
              metadata.cliVersion.toLowerCase().includes(normalizedQuery))) ||
          authorizerName.includes(normalizedQuery) ||
          authorization.authorizedBy.user.email.toLowerCase().includes(normalizedQuery);
        return matchesQuery && (statuses.size === 0 || statuses.has(authorization.status));
      }),
    [data, normalizedQuery, statuses],
  );
  const rows = useMemo(() => {
    const sorter = sorters[String(sort.column)];
    if (!sorter) return filtered;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.toSorted((left, right) => sorter(left, right) * direction);
  }, [filtered, sort]);
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
          label: status === "active" ? "Active" : "Revoked",
          content: <OAuthAuthorizationStatusDisplay status={status} />,
          count: data.filter((authorization) => authorization.status === status).length,
        })),
        onSelectionChange: (keys) => setStatuses(toTableSelection(keys, statusOptions)),
      },
    ],
    [data, statuses],
  );
  const clearFilters = useEventCallback(() => setStatuses(defaultStatuses));
  const renderEmptyState = useEventCallback(() => {
    if (data.length === 0) return "No CLI authorizations yet.";
    return normalizedQuery.length > 0 || statuses.size > 0
      ? "No CLI authorizations match these filters."
      : "No CLI authorizations yet.";
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <SearchField
          aria-label="Filter CLI authorizations"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter authorizations…" />
            <SearchField.ClearButton aria-label="Clear authorization search" />
          </SearchField.Group>
        </SearchField>
        <div className="ml-auto">
          <TableControls>
            <TableFilterControl
              ariaLabel="Apply CLI authorization filters"
              facets={facets}
              onClear={clearFilters}
            />
          </TableControls>
        </div>
      </div>
      {authorizations.isError ? (
        <DataError
          compact
          label="CLI authorizations"
          onRetry={authorizations.refetch}
          isRetrying={authorizations.isFetching}
        />
      ) : null}
      {isInitialLoading ? (
        <DataLoading className="min-h-64" label="Loading CLI authorizations" />
      ) : (
        <DataGrid
          aria-label="CLI authorizations"
          columns={columns}
          data={rows}
          getRowId={getRowId}
          renderEmptyState={renderEmptyState}
          sortDescriptor={sort}
          variant="secondary"
          onSortChange={setSort}
        />
      )}
    </div>
  );
}
