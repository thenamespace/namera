// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useMemo, useState } from "react";

import type { BetaInviteListEntry, BetaInviteStatus } from "@namera-ai/protocol/model";
import {
  Button,
  DataGrid,
  Dropdown,
  Label,
  ListBox,
  SearchField,
  Select,
  type DataGridColumn,
} from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon, MoreHorizontalIcon } from "@namera-ai/ui/icons";

import { PermissionGuard, manageInvitesPermission } from "@/components/permission";
import { MemberDisplay, EmailDisplay } from "@/components/team-display";
import { useInvites } from "@/hooks/invites";

import { CreateInvitesDialog } from "./create-dialog";
import { InviteDate, InviteStatus } from "./invite-display";
import { RevokeInviteDialog } from "./revoke-dialog";

const getId = (invite: BetaInviteListEntry) => invite.id;
const filters = [
  { id: "all", label: "All statuses" },
  { id: "active", label: "Active" },
  { id: "redeemed", label: "Redeemed" },
  { id: "revoked", label: "Revoked" },
  { id: "expired", label: "Expired" },
];

const columnsFor = (
  revoke: (invite: BetaInviteListEntry) => void,
): DataGridColumn<BetaInviteListEntry>[] => [
  {
    id: "email",
    header: "Email",
    isRowHeader: true,
    minWidth: 220,
    width: "1fr",
    cell: (invite) =>
      invite.email ? (
        <EmailDisplay email={invite.email} />
      ) : (
        <span className="text-muted text-sm">Anyone with the code</span>
      ),
  },
  {
    id: "status",
    header: "Status",
    width: 140,
    cell: (invite) => <InviteStatus status={invite.status} />,
  },
  {
    id: "createdAt",
    header: "Created",
    width: 160,
    cell: (invite) => <InviteDate value={invite.createdAt} label="Created" />,
  },
  {
    id: "expiresAt",
    header: "Expires",
    width: 160,
    cell: (invite) => <InviteDate value={invite.expiresAt} label="Expires" />,
  },
  {
    id: "redeemedBy",
    header: "Used by",
    minWidth: 200,
    width: 240,
    cell: (invite) =>
      invite.redeemedByEmail && invite.redeemedByMetadata ? (
        <div className="grid gap-1 py-1">
          <MemberDisplay email={invite.redeemedByEmail} metadata={invite.redeemedByMetadata} />
          <EmailDisplay email={invite.redeemedByEmail} />
        </div>
      ) : (
        <span className="text-muted text-sm">
          {invite.redeemedAt ? "Deleted user" : "Not redeemed"}
        </span>
      ),
  },
  {
    id: "redeemedAt",
    header: "Redeemed",
    width: 160,
    cell: (invite) =>
      invite.redeemedAt ? (
        <InviteDate value={invite.redeemedAt} label="Redeemed" />
      ) : (
        <span className="text-muted text-sm">Not redeemed</span>
      ),
  },
  {
    id: "reference",
    header: "Reference",
    width: 160,
    cell: (invite) => (
      <span className="text-muted select-all text-xs" title={invite.id}>
        {invite.id.slice(-12)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    width: 48,
    pinned: "end",
    align: "end",
    cell: (invite) =>
      invite.status === "active" ? (
        <PermissionGuard required={manageInvitesPermission}>
          <Dropdown>
            <Button
              size="sm"
              variant="tertiary"
              isIconOnly
              aria-label={`Actions for invite ${invite.id.slice(-12)}`}
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} />
            </Button>
            <Dropdown.Popover className="min-w-44">
              <Dropdown.Menu onAction={() => revoke(invite)}>
                <Dropdown.Item id="revoke" textValue="Revoke code" variant="danger">
                  <Label>Revoke code</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </PermissionGuard>
      ) : null,
  },
];

export function InvitesTable() {
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<BetaInviteStatus | "all">("all");
  const [cursors, setCursors] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<BetaInviteListEntry | null>(null);
  const cursor = cursors.at(-1);
  const invites = useInvites({
    ...(email ? { email } : {}),
    ...(status === "all" ? {} : { status }),
    ...(cursor ? { cursor } : {}),
  });
  const columns = useMemo(() => columnsFor(setRevoking), []);
  const rows = useMemo(() => [...(invites.data?.entries ?? [])], [invites.data]);
  const nextCursor = invites.data?.nextCursor;
  const filtered = Boolean(email) || status !== "all";
  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted text-sm">Create and manage single-use codes for joining Namera.</p>
        <PermissionGuard required={manageInvitesPermission}>
          <Button size="sm" className="self-start sm:self-auto" onPress={() => setCreating(true)}>
            <HugeiconsIcon icon={Add01Icon} />
            Create invite codes
          </Button>
        </PermissionGuard>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          className="flex min-w-0 gap-2 sm:max-w-96"
          onSubmit={(event) => {
            event.preventDefault();
            setEmail(emailInput.trim());
            setCursors([]);
          }}
        >
          <SearchField
            aria-label="Search bound email"
            value={emailInput}
            onChange={(value) => {
              setEmailInput(value);
              if (!value) {
                setEmail("");
                setCursors([]);
              }
            }}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search bound email…" />
              <SearchField.ClearButton aria-label="Clear email search" />
            </SearchField.Group>
          </SearchField>
          <Button type="submit" variant="tertiary" size="sm">
            Search
          </Button>
        </form>
        <Select
          aria-label="Filter by status"
          selectedKey={status}
          variant="secondary"
          className="w-full sm:w-44"
          onSelectionChange={(key) => {
            const value = filters.find((filter) => filter.id === key)?.id;
            if (value) {
              setStatus(value as BetaInviteStatus | "all");
              setCursors([]);
            }
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox items={filters}>
              {(filter) => (
                <ListBox.Item id={filter.id} textValue={filter.label}>
                  {filter.label}
                </ListBox.Item>
              )}
            </ListBox>
          </Select.Popover>
        </Select>
        <Button
          variant="tertiary"
          size="sm"
          isDisabled={invites.isFetching}
          onPress={invites.refetch}
        >
          Refresh
        </Button>
      </div>
      {invites.error ? (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <p>Couldn’t load invite codes.</p>
          <Button size="sm" variant="tertiary" onPress={invites.refetch}>
            Try again
          </Button>
        </div>
      ) : invites.isPending && !invites.data ? (
        <output className="text-muted text-sm">Loading invite codes…</output>
      ) : rows.length === 0 ? (
        <p className="text-muted py-12 text-center text-sm">
          {filtered
            ? "No invite codes match these filters."
            : cursors.length
              ? "No more invite codes. Go back to the previous page."
              : "No invite codes yet. Owners and operators can create one to invite someone."}
        </p>
      ) : (
        <DataGrid
          aria-label="Invite codes"
          columns={columns}
          data={rows}
          getRowId={getId}
          variant="secondary"
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted text-xs">
          Codes are shown only when created. Newest invites first.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!cursors.length || invites.isFetching}
            onPress={() => setCursors((previous) => previous.slice(0, -1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!nextCursor || invites.isFetching}
            onPress={() => {
              if (nextCursor) setCursors((previous) => [...previous, nextCursor]);
            }}
          >
            Next
          </Button>
        </div>
      </div>
      {creating ? <CreateInvitesDialog onClose={() => setCreating(false)} /> : null}
      {revoking ? <RevokeInviteDialog invite={revoking} onClose={() => setRevoking(null)} /> : null}
    </div>
  );
}
