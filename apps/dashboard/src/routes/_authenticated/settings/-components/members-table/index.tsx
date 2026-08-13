import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type {
  GetOrganizationMemberResponse,
  GetOrganizationRoleResponse,
  ListOrganizationMemberResponse,
} from "@namera-ai/protocol/dto";
import { DataGrid, SearchField, Typography, type DataGridColumn } from "@namera-ai/ui";

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
    sortFn: (left, right) => memberCollator.compare(left.user.email, right.user.email),
  },
  {
    allowsSorting: true,
    cell: ({ organizationRole }) => <OrganizationRoleDisplay role={organizationRole} />,
    header: "Role",
    id: "role",
    minWidth: 120,
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
const emptyRoles: ReadonlyArray<GetOrganizationRoleResponse> = [];

type MembersTableProps = {
  canManageMembers: boolean;
  canReadRoles: boolean;
  initialMembers: ListOrganizationMemberResponse;
  initialRoles: ReadonlyArray<GetOrganizationRoleResponse>;
};

type MembersTableContentProps = {
  canManageMembers: boolean;
  memberData: ListOrganizationMemberResponse;
  members: ReturnType<typeof useOrganizationMembers>;
  roleData: ReadonlyArray<GetOrganizationRoleResponse>;
  rolesError: boolean;
  rolesLoading: boolean;
};

export function MembersTable(props: MembersTableProps) {
  const members = useOrganizationMembers();
  const memberData = members.data ?? props.initialMembers;

  return props.canReadRoles ? (
    <MembersTableWithRoles {...props} memberData={memberData} members={members} />
  ) : (
    <MembersTableContent
      canManageMembers={props.canManageMembers}
      memberData={memberData}
      members={members}
      roleData={emptyRoles}
      rolesError={false}
      rolesLoading={false}
    />
  );
}

type MembersTableWithRolesProps = {
  canManageMembers: boolean;
  initialRoles: ReadonlyArray<GetOrganizationRoleResponse>;
  memberData: ListOrganizationMemberResponse;
  members: ReturnType<typeof useOrganizationMembers>;
};

function MembersTableWithRoles({
  canManageMembers,
  initialRoles,
  memberData,
  members,
}: MembersTableWithRolesProps) {
  const roles = useAssignableOrganizationRoles();
  const roleData = roles.data ?? initialRoles;

  return (
    <MembersTableContent
      canManageMembers={canManageMembers}
      memberData={memberData}
      members={members}
      roleData={roleData}
      rolesError={roles.isError}
      rolesLoading={roles.isLoading}
    />
  );
}

function MembersTableContent({
  canManageMembers,
  memberData,
  members,
  roleData,
  rolesError,
  rolesLoading,
}: MembersTableContentProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const columns = useMemo(
    () => createMemberColumns(roleData, canManageMembers),
    [canManageMembers, roleData],
  );

  const visibleMembers = useMemo(
    () =>
      memberData.filter(({ user }) => {
        const name = user.metadata.name?.toLowerCase() ?? "";
        return name.includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery);
      }),
    [memberData, normalizedQuery],
  );

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
        <PermissionGuard required={invitationCreatePermission}>
          <InviteMemberDialog initialRoles={roleData} />
        </PermissionGuard>
      </div>

      {members.isLoading || rolesLoading ? (
        <Typography color="muted">Loading members…</Typography>
      ) : null}
      {members.isError || rolesError ? (
        <Typography className="text-danger">Couldn’t load organization members.</Typography>
      ) : null}
      <DataGrid
        aria-label="Organization members"
        columns={columns}
        contentClassName="min-w-[760px]"
        data={visibleMembers}
        getRowId={getMemberId}
        renderEmptyState={renderEmptyState}
        variant="secondary"
      />
    </div>
  );
}
