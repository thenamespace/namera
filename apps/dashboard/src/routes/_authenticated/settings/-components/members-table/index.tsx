import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type {
  GetOrganizationMemberResponse,
  GetOrganizationRoleResponse,
  ListOrganizationMemberResponse,
} from "@namera-ai/protocol/dto";
import {
  DataGrid,
  SearchField,
  Typography,
  type DataGridColumn,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import { TableViewOptions, type TableOption } from "@/components/common/table";
import { DataLoading } from "@/components/data-loading";
import {
  DateDisplay,
  EmailDisplay,
  MetadataDisplay,
  OrganizationRoleDisplay,
} from "@/components/display";
import { PermissionGuard } from "@/components/permission";
import { useAssignableOrganizationRoles, useOrganizationMembers } from "@/hooks/auth";

import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberActions } from "./member-actions";

const memberCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const createMemberColumns = (
  assignableRoles: ReadonlyArray<GetOrganizationRoleResponse>,
  canManageMembers: boolean,
): DataGridColumn<GetOrganizationMemberResponse>[] => [
  {
    allowsSorting: true,
    cell: ({ user }) => <MetadataDisplay fallbackName={user.email} metadata={user.metadata} />,
    header: "Name",
    id: "name",
    isRowHeader: true,
    minWidth: 180,
    pinned: "start",
    width: "1fr",
    sortFn: (left, right) =>
      memberCollator.compare(
        left.user.metadata.name ?? left.user.email,
        right.user.metadata.name ?? right.user.email,
      ),
  },
  {
    allowsSorting: true,
    cell: ({ user }) => <EmailDisplay email={user.email} />,
    header: "Email",
    id: "email",
    minWidth: 220,
    width: 260,
    sortFn: (left, right) => memberCollator.compare(left.user.email, right.user.email),
  },
  {
    allowsSorting: true,
    cell: ({ organizationRole }) => <OrganizationRoleDisplay role={organizationRole} />,
    header: "Role",
    id: "role",
    minWidth: 120,
    width: 150,
    sortFn: (left, right) =>
      memberCollator.compare(
        left.organizationRole.metadata.name,
        right.organizationRole.metadata.name,
      ),
  },
  {
    allowsSorting: true,
    cell: ({ organizationMember }) => (
      <DateDisplay label="Joined" value={organizationMember.joinedAt} />
    ),
    header: "Joined",
    id: "joinedAt",
    minWidth: 140,
    width: 160,
    sortFn: (left, right) =>
      DateTime.toEpochMillis(left.organizationMember.joinedAt) -
      DateTime.toEpochMillis(right.organizationMember.joinedAt),
  },
  ...(canManageMembers && assignableRoles.length > 0
    ? [
        {
          align: "end" as const,
          cell: (member: GetOrganizationMemberResponse) => (
            <MemberActions assignableRoles={assignableRoles} member={member} />
          ),
          header: "",
          id: "actions",
          pinned: "end" as const,
          width: 48,
        },
      ]
    : []),
];

const getMemberId = ({ organizationMember }: GetOrganizationMemberResponse) =>
  organizationMember.id;

const renderEmptyState = () => "No members found.";
const invitationCreatePermission = ["invitation:create"] as const;
const emptyMembers: ListOrganizationMemberResponse = [];
const emptyRoles: ReadonlyArray<GetOrganizationRoleResponse> = [];
const fixedColumnOptions = [{ id: "name", label: "Name" }] as const;

type MembersTableProps = {
  canManageMembers: boolean;
  canReadRoles: boolean;
  initialMembers?: ListOrganizationMemberResponse;
  initialRoles?: ReadonlyArray<GetOrganizationRoleResponse>;
};

type MembersTableContentProps = {
  canManageMembers: boolean;
  memberData: ListOrganizationMemberResponse;
  members: ReturnType<typeof useOrganizationMembers>;
  membersInitialLoading: boolean;
  roleData: ReadonlyArray<GetOrganizationRoleResponse>;
  rolesError: boolean;
  rolesLoading: boolean;
};

export function MembersTable(props: MembersTableProps) {
  const members = useOrganizationMembers();
  const memberData = members.data ?? props.initialMembers ?? emptyMembers;
  const membersInitialLoading =
    members.isLoading && members.data === undefined && props.initialMembers === undefined;

  return props.canReadRoles ? (
    <MembersTableWithRoles
      {...props}
      memberData={memberData}
      members={members}
      membersInitialLoading={membersInitialLoading}
    />
  ) : (
    <MembersTableContent
      canManageMembers={props.canManageMembers}
      memberData={memberData}
      members={members}
      membersInitialLoading={membersInitialLoading}
      roleData={emptyRoles}
      rolesError={false}
      rolesLoading={false}
    />
  );
}

type MembersTableWithRolesProps = {
  canManageMembers: boolean;
  initialRoles?: ReadonlyArray<GetOrganizationRoleResponse>;
  memberData: ListOrganizationMemberResponse;
  members: ReturnType<typeof useOrganizationMembers>;
  membersInitialLoading: boolean;
};

function MembersTableWithRoles({
  canManageMembers,
  initialRoles,
  memberData,
  members,
  membersInitialLoading,
}: MembersTableWithRolesProps) {
  const roles = useAssignableOrganizationRoles();
  const roleData = roles.data ?? initialRoles ?? emptyRoles;

  return (
    <MembersTableContent
      canManageMembers={canManageMembers}
      memberData={memberData}
      members={members}
      membersInitialLoading={membersInitialLoading}
      roleData={roleData}
      rolesError={roles.isError}
      rolesLoading={roles.isLoading && roles.data === undefined && initialRoles === undefined}
    />
  );
}

function MembersTableContent({
  canManageMembers,
  memberData,
  members,
  membersInitialLoading,
  roleData,
  rolesError,
  rolesLoading,
}: MembersTableContentProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "joinedAt",
    direction: "descending",
  });
  const [visibleColumns, setVisibleColumns] = useState<DataGridSelection>(
    new Set(["email", "role", "joinedAt"]),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const columns = useMemo(
    () => createMemberColumns(roleData, canManageMembers),
    [canManageMembers, roleData],
  );

  const filteredMembers = useMemo(
    () =>
      memberData.filter(({ user }) => {
        const name = user.metadata.name?.toLowerCase() ?? "";
        return name.includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery);
      }),
    [memberData, normalizedQuery],
  );
  const sortedMembers = useMemo(() => {
    const sorter = columns.find((column) => column.id === sort.column)?.sortFn;
    if (!sorter) return filteredMembers;
    const direction = sort.direction === "descending" ? -1 : 1;
    return filteredMembers.toSorted((left, right) => sorter(left, right) * direction);
  }, [columns, filteredMembers, sort]);
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
  const displayedColumns = useMemo(() => {
    const visible =
      visibleColumns === "all" ? new Set(configurableColumns.map(({ id }) => id)) : visibleColumns;
    return columns.filter(
      (column) => column.id === "name" || column.id === "actions" || visible.has(column.id),
    );
  }, [columns, configurableColumns, visibleColumns]);
  const resetView = useEventCallback(() => {
    setSort({ column: "joinedAt", direction: "descending" });
    setVisibleColumns(new Set(["email", "role", "joinedAt"]));
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          aria-label="Filter members by name or email"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter by name or email..." />
            <SearchField.ClearButton aria-label="Clear member filter" />
          </SearchField.Group>
        </SearchField>
        <div className="ml-auto flex items-center gap-2">
          <TableViewOptions
            ariaLabel="Configure members table view"
            columnOptions={configurableColumns}
            fixedColumnOptions={fixedColumnOptions}
            sort={sort}
            sortableColumns={sortableColumns}
            visibleColumns={visibleColumns}
            onReset={resetView}
            onSortChange={setSort}
            onVisibleColumnsChange={setVisibleColumns}
          />
          <PermissionGuard required={invitationCreatePermission}>
            <InviteMemberDialog initialRoles={roleData} />
          </PermissionGuard>
        </div>
      </div>

      {members.isError || rolesError ? (
        <Typography className="text-danger">Couldn’t load organization members.</Typography>
      ) : null}
      {membersInitialLoading || rolesLoading ? (
        <DataLoading className="min-h-64" label="Loading members" />
      ) : (
        <DataGrid
          aria-label="Organization members"
          columns={displayedColumns}
          data={sortedMembers}
          getRowId={getMemberId}
          renderEmptyState={renderEmptyState}
          sortDescriptor={sort}
          variant="secondary"
          onSortChange={setSort}
        />
      )}
    </div>
  );
}
