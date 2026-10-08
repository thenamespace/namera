// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type { PlatformMemberView } from "@namera-ai/protocol/model";
import {
  Button,
  DataGrid,
  Dropdown,
  Label,
  SearchField,
  type DataGridColumn,
  type DataGridSortDescriptor,
} from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon, MoreHorizontalIcon } from "@namera-ai/ui/icons";

import { PermissionGuard, manageTeamPermission } from "@/components/permission";
import {
  MemberDisplay,
  EmailDisplay,
  RoleDisplay,
  MemberStatusDisplay,
  JoinedDisplay,
} from "@/components/team-display";
import { useMembers } from "@/hooks/team";

import { MemberDialog, type MemberDialogState } from "./member-dialog";

const getMemberId = (member: typeof PlatformMemberView.Type) => member.id;
const emptyState = () => "No members found.";
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

const createColumns = (
  setDialog: (state: MemberDialogState) => void,
): DataGridColumn<typeof PlatformMemberView.Type>[] => [
  {
    id: "name",
    header: "Name",
    isRowHeader: true,
    pinned: "start",
    minWidth: 180,
    width: "1fr",
    allowsSorting: true,
    cell: (member) => <MemberDisplay email={member.email} metadata={member.metadata} />,
  },
  {
    id: "email",
    header: "Email",
    minWidth: 240,
    width: 260,
    allowsSorting: true,
    cell: (member) => <EmailDisplay email={member.email} />,
  },
  {
    id: "role",
    header: "Role",
    minWidth: 120,
    width: 150,
    allowsSorting: true,
    cell: (member) => <RoleDisplay role={member.role} />,
  },
  {
    id: "status",
    header: "Status",
    minWidth: 120,
    width: 150,
    allowsSorting: true,
    cell: (member) => <MemberStatusDisplay status={member.status} />,
  },
  {
    id: "createdAt",
    header: "Joined",
    minWidth: 140,
    width: 160,
    allowsSorting: true,
    cell: (member) => <JoinedDisplay value={member.createdAt} />,
  },
  {
    id: "actions",
    header: "",
    pinned: "end",
    width: 48,
    align: "end",
    cell: (member) =>
      member.role !== "owner" && member.status !== "removed" ? (
        <PermissionGuard required={manageTeamPermission}>
          <Dropdown>
            <Button
              isIconOnly
              aria-label={`Actions for ${member.email}`}
              size="sm"
              variant="tertiary"
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} />
            </Button>
            <Dropdown.Popover className="min-w-44">
              <Dropdown.Menu
                onAction={(key) => {
                  if (key === "role" || key === "remove") setDialog({ type: key, member });
                }}
              >
                <Dropdown.Item id="role" textValue="Update role">
                  <Label>Update role</Label>
                </Dropdown.Item>
                <Dropdown.Item id="remove" textValue="Remove member" variant="danger">
                  <Label>Remove member</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </PermissionGuard>
      ) : null,
  },
];

export function MembersTable() {
  const members = useMembers();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DataGridSortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [dialog, setDialog] = useState<MemberDialogState | null>(null);
  const columns = useMemo(() => createColumns(setDialog), []);
  const data = useMemo(
    () =>
      [...(members.data ?? [])]
        .filter((member) =>
          `${member.email} ${member.metadata.name ?? ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .toSorted((left, right) => {
          const compared =
            sort.column === "createdAt"
              ? DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt)
              : sort.column === "name"
                ? collator.compare(
                    left.metadata.name ?? left.email,
                    right.metadata.name ?? right.email,
                  )
                : collator.compare(
                    left[
                      sort.column === "role"
                        ? "role"
                        : sort.column === "status"
                          ? "status"
                          : "email"
                    ],
                    right[
                      sort.column === "role"
                        ? "role"
                        : sort.column === "status"
                          ? "status"
                          : "email"
                    ],
                  );
          return sort.direction === "ascending" ? compared : -compared;
        }),
    [members.data, query, sort],
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
        <PermissionGuard required={manageTeamPermission}>
          <Button
            className="self-start sm:self-auto"
            size="sm"
            onPress={() => setDialog({ type: "invite" })}
          >
            <HugeiconsIcon icon={Add01Icon} />
            Invite
          </Button>
        </PermissionGuard>
      </div>
      {members.error ? (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <p>Couldn’t load team members.</p>
          <Button size="sm" variant="tertiary" onPress={members.refetch}>
            Try again
          </Button>
        </div>
      ) : members.isPending && !members.data ? (
        <output className="text-muted text-sm">Loading members…</output>
      ) : (
        <DataGrid
          aria-label="Admin team members"
          columns={columns}
          data={data}
          getRowId={getMemberId}
          renderEmptyState={emptyState}
          sortDescriptor={sort}
          onSortChange={setSort}
          variant="secondary"
        />
      )}
      {dialog ? <MemberDialog state={dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
