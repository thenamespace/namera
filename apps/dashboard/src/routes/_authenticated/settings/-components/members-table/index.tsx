import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type { GetOrganizationMemberResponse } from "@namera-ai/protocol/dto";
import { DataGrid, SearchField, type DataGridColumn } from "@namera-ai/ui";

import {
  DateDisplay,
  EmailDisplay,
  MetadataDisplay,
  OrganizationRoleDisplay,
} from "@/components/display";

import { demoMembers } from "./data";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberActions } from "./member-actions";

const memberCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const memberColumns: DataGridColumn<GetOrganizationMemberResponse>[] = [
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
  {
    align: "end",
    cell: ({ user }) => <MemberActions name={user.metadata.name ?? user.email} />,
    header: "",
    id: "actions",
    pinned: "end",
    width: 48,
  },
];

const getMemberId = ({ organizationMember }: GetOrganizationMemberResponse) =>
  organizationMember.id;

const renderEmptyState = () => "No members found.";

export function MembersTable() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const visibleMembers = useMemo(
    () =>
      demoMembers.filter(({ user }) => {
        const name = user.metadata.name?.toLowerCase() ?? "";
        return name.includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery);
      }),
    [normalizedQuery],
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          aria-label="Filter members by name or email"
          className="w-full sm:max-w-80"
          value={query}
          onChange={setQuery}
          variant="secondary"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter by name or email..." />
            <SearchField.ClearButton aria-label="Clear member filter" />
          </SearchField.Group>
        </SearchField>
        <InviteMemberDialog />
      </div>

      <DataGrid
        aria-label="Organization members"
        columns={memberColumns}
        contentClassName="min-w-[760px]"
        data={visibleMembers}
        getRowId={getMemberId}
        renderEmptyState={renderEmptyState}
        variant="secondary"
      />
    </div>
  );
}
