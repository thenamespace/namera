import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type { GetInvitationResponse } from "@namera-ai/protocol/dto";
import {
  Button,
  DataGrid,
  SearchField,
  Typography,
  type DataGridColumn,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import { Activity01Icon, HugeiconsIcon, UserMultiple02Icon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  TableControls,
  TableFilterControl,
  TableViewOptions,
  toTableSelection,
  type TableFilterFacet,
  type TableOption,
} from "@/components/common/table";
import { DataLoading } from "@/components/data-loading";
import {
  DateDisplay,
  EmailDisplay,
  InvitationStatusDisplay,
  OrganizationRoleDisplay,
} from "@/components/display";
import {
  useAssignableOrganizationRoles,
  useCancelInvitation,
  useOrganizationInvitations,
} from "@/hooks/auth";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });
const statusOptions = ["pending", "accepted", "rejected", "canceled", "expired"] as const;
type InvitationStatus = GetInvitationResponse["invitation"]["status"];
const defaultStatuses: ReadonlySet<InvitationStatus> = new Set(["pending"]);
const columnIds = ["role", "status", "expiresAt"] as const;
const groupingOptions = [
  { id: "none", label: "No grouping" },
  { id: "role", label: "Role" },
  { id: "status", label: "Status" },
] as const;
type Grouping = (typeof groupingOptions)[number]["id"];
type GroupRow = {
  children: ReadonlyArray<GetInvitationResponse>;
  grouping: Exclude<Grouping, "none">;
  id: string;
  kind: "group";
  label: string;
  role?: GetInvitationResponse["organizationRole"];
};
type Row = GetInvitationResponse | GroupRow;
const isGroup = (row: Row): row is GroupRow => "kind" in row;

function CancelInvitationButton({ invitation }: { invitation: GetInvitationResponse }) {
  const cancelInvitation = useCancelInvitation({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t cancel invitation",
        description: "The invitation is still active.",
      }),
    onSuccess: () => showSuccessToast({ title: "Invitation canceled" }),
  });
  const handleCancel = useEventCallback(() => {
    cancelInvitation.mutate({ payload: { invitationId: invitation.invitation.id } });
  });

  return (
    <Button
      isDisabled={cancelInvitation.isPending}
      size="sm"
      variant="danger-soft"
      onPress={handleCancel}
    >
      {cancelInvitation.isPending ? "Cancelling…" : "Cancel"}
    </Button>
  );
}

const createColumns = (canCancel: boolean): ReadonlyArray<DataGridColumn<Row>> => [
  {
    allowsSorting: true,
    cell: (row) =>
      isGroup(row) ? (
        <span className="flex items-center gap-2">
          {row.grouping === "role" && row.role ? (
            <OrganizationRoleDisplay role={row.role} />
          ) : (
            <InvitationStatusDisplay status={row.label as InvitationStatus} />
          )}
          <span className="text-xs tabular-nums text-muted">{row.children.length}</span>
        </span>
      ) : (
        <EmailDisplay email={row.invitation.email} />
      ),
    header: "Email",
    id: "email",
    isRowHeader: true,
    minWidth: 220,
    pinned: "start",
    width: "1fr",
  },
  {
    allowsSorting: true,
    cell: (row) => (isGroup(row) ? null : <OrganizationRoleDisplay role={row.organizationRole} />),
    header: "Role",
    id: "role",
    minWidth: 150,
    width: 180,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isGroup(row) ? null : <InvitationStatusDisplay status={row.invitation.status} />,
    header: "Status",
    id: "status",
    minWidth: 110,
    width: 125,
  },
  {
    allowsSorting: true,
    cell: (row) =>
      isGroup(row) ? null : <DateDisplay label="Expires" value={row.invitation.expiresAt} />,
    header: "Expires",
    id: "expiresAt",
    minWidth: 150,
    width: 170,
  },
  ...(canCancel
    ? [
        {
          align: "end" as const,
          cell: (row: Row) => (isGroup(row) ? null : <CancelInvitationButton invitation={row} />),
          header: <span className="sr-only">Actions</span>,
          id: "actions",
          pinned: "end" as const,
          width: 100,
        },
      ]
    : []),
];

const sorters: Record<
  string,
  (left: GetInvitationResponse, right: GetInvitationResponse) => number
> = {
  email: (left, right) => collator.compare(left.invitation.email, right.invitation.email),
  role: (left, right) =>
    collator.compare(left.organizationRole.metadata.name, right.organizationRole.metadata.name),
  status: (left, right) => collator.compare(left.invitation.status, right.invitation.status),
  expiresAt: (left, right) =>
    DateTime.toEpochMillis(left.invitation.expiresAt) -
    DateTime.toEpochMillis(right.invitation.expiresAt),
};
const getRowId = (row: Row) => (isGroup(row) ? row.id : row.invitation.id);
const getChildren = (row: Row) => (isGroup(row) ? [...row.children] : undefined);
const fixedColumnOptions = [{ id: "email", label: "Email" }] as const;
const emptyInvitations: ReadonlyArray<GetInvitationResponse> = [];

type InvitationsTableProps = {
  canCancel: boolean;
  initialInvitations?: ReadonlyArray<GetInvitationResponse>;
};

export function InvitationsTable({ canCancel, initialInvitations }: InvitationsTableProps) {
  const invitations = useOrganizationInvitations();
  const organizationRoles = useAssignableOrganizationRoles();
  const data = invitations.data ?? initialInvitations ?? emptyInvitations;
  const isInitialLoading =
    invitations.isLoading && invitations.data === undefined && initialInvitations === undefined;
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<ReadonlySet<InvitationStatus>>(defaultStatuses);
  const [roles, setRoles] = useState<ReadonlySet<string>>(new Set());
  const [grouping, setGrouping] = useState<Grouping>("none");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "expiresAt",
    direction: "ascending",
  });
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(new Set(columnIds));
  const columns = useMemo(() => createColumns(canCancel), [canCancel]);
  const configurableColumns = useMemo<ReadonlyArray<TableOption>>(
    () =>
      columns
        .filter((column) => column.id !== "email" && column.id !== "actions")
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
  const roleOptions = useMemo(
    () =>
      [
        ...new Map(
          [...(organizationRoles.data ?? []), ...data.map((item) => item.organizationRole)].map(
            (role) => [role.id, role],
          ),
        ).values(),
      ].map((role) => ({
        id: role.id,
        label: role.metadata.name,
        content: <OrganizationRoleDisplay role={role} />,
        count: data.filter((item) => item.organizationRole.id === role.id).length,
      })),
    [data, organizationRoles.data],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      data.filter((item) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          item.invitation.email.toLowerCase().includes(normalizedQuery) ||
          item.organizationRole.metadata.name.toLowerCase().includes(normalizedQuery);
        return (
          matchesQuery &&
          (statuses.size === 0 || statuses.has(item.invitation.status)) &&
          (roles.size === 0 || roles.has(item.organizationRole.id))
        );
      }),
    [data, normalizedQuery, roles, statuses],
  );
  const sorted = useMemo(() => {
    const sorter = sorters[String(sort.column)];
    if (!sorter) return filtered;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.toSorted((left, right) => sorter(left, right) * direction);
  }, [filtered, sort]);
  const rows = useMemo<Row[]>(() => {
    if (grouping === "none") return sorted;
    const grouped = new Map<string, GetInvitationResponse[]>();
    for (const item of sorted) {
      const value = grouping === "role" ? item.organizationRole.id : item.invitation.status;
      grouped.set(value, [...(grouped.get(value) ?? []), item]);
    }
    return [...grouped.entries()].map(([value, children]) => {
      const row: GroupRow = {
        children,
        grouping,
        id: `group:${grouping}:${value}`,
        kind: "group",
        label: grouping === "role" ? (children[0]?.organizationRole.metadata.name ?? value) : value,
      };
      if (grouping === "role" && children[0]) row.role = children[0].organizationRole;
      return row;
    });
  }, [grouping, sorted]);
  const displayedColumns = useMemo(() => {
    const visible = visibleColumns === "all" ? new Set(columnIds) : visibleColumns;
    return columns.filter(
      (column) =>
        column.id === "email" || column.id === "actions" || visible.has(column.id as never),
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
          content: <InvitationStatusDisplay status={status} />,
          count: data.filter((item) => item.invitation.status === status).length,
        })),
        onSelectionChange: (keys) => setStatuses(toTableSelection(keys, statusOptions)),
      },
      {
        id: "role",
        label: "Role",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={UserMultiple02Icon} />,
        selectedKeys: roles,
        options: roleOptions,
        onSelectionChange: (keys) =>
          setRoles(
            toTableSelection(
              keys,
              roleOptions.map(({ id }) => id),
            ),
          ),
      },
    ],
    [data, roleOptions, roles, statuses],
  );
  const resetView = useEventCallback(() => {
    setGrouping("none");
    setSort({ column: "expiresAt", direction: "ascending" });
    setVisibleColumns(new Set(columnIds));
  });
  const renderEmptyState = useEventCallback(() =>
    data.length === 0 ? "No invitations yet." : "No invitations match these filters.",
  );
  const clearFilters = useEventCallback(() => {
    setStatuses(defaultStatuses);
    setRoles(new Set());
  });
  const handleGroupingChange = useEventCallback((value: string) => {
    setGrouping(value as Grouping);
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <SearchField
          aria-label="Filter invitations"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter invitations…" />
            <SearchField.ClearButton aria-label="Clear invitation search" />
          </SearchField.Group>
        </SearchField>
        <div className="ml-auto">
          <TableControls>
            <TableFilterControl
              ariaLabel="Apply invitation filters"
              facets={facets}
              onClear={clearFilters}
            />
            <TableViewOptions
              ariaLabel="Configure invitation table view"
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
      {invitations.isError ? (
        <Typography className="text-danger">Couldn’t load organization invitations.</Typography>
      ) : null}
      {isInitialLoading ? (
        <DataLoading className="min-h-64" label="Loading invitations" />
      ) : (
        <DataGrid
          aria-label="Organization invitations"
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
