// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useMemo, useState } from "react";

import type { WaitlistEntry, WaitlistStatus } from "@namera-ai/protocol/model";
import {
  Button,
  DataGrid,
  ListBox,
  SearchField,
  Select,
  Typography,
  type DataGridColumn,
} from "@namera-ai/ui";
import { CheckmarkCircle02Icon, Clock01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { PermissionGuard, acceptWaitlistPermission } from "@/components/permission";
import { EmailDisplay } from "@/components/team-display";
import { useWaitlist } from "@/hooks/waitlist";

import { AcceptWaitlistDialog } from "./accept-dialog";

const getId = (entry: WaitlistEntry) => entry.id;
const filters = [
  { id: "all", label: "All statuses" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
] as const;

const columnsFor = (accept: (entry: WaitlistEntry) => void): DataGridColumn<WaitlistEntry>[] => [
  {
    id: "email",
    header: "Email",
    isRowHeader: true,
    minWidth: 240,
    width: "1fr",
    cell: (entry) => <EmailDisplay email={entry.email} />,
  },
  {
    id: "status",
    header: "Status",
    width: 180,
    cell: (entry) => (
      <span className="inline-flex items-center gap-2 text-sm">
        <HugeiconsIcon
          icon={entry.status === "completed" ? CheckmarkCircle02Icon : Clock01Icon}
          className={`size-4 shrink-0 ${entry.status === "completed" ? "text-success" : "text-muted"}`}
        />
        {entry.status === "completed" ? "Completed" : "Pending"}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    width: 112,
    pinned: "end",
    align: "end",
    cell: (entry) =>
      entry.status === "pending" ? (
        <PermissionGuard required={acceptWaitlistPermission}>
          <Button
            size="sm"
            variant="tertiary"
            aria-label={`Accept ${entry.email}`}
            onPress={() => accept(entry)}
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} />
            Accept
          </Button>
        </PermissionGuard>
      ) : null,
  },
];

export function WaitlistTable() {
  const [emailInput, setEmailInput] = useState("");
  const email = emailInput.trim();
  const [status, setStatus] = useState<WaitlistStatus | "all">("all");
  const [cursors, setCursors] = useState<string[]>([]);
  const [accepting, setAccepting] = useState<WaitlistEntry | null>(null);
  const cursor = cursors.at(-1);
  const waitlist = useWaitlist({
    ...(email ? { email } : {}),
    ...(status === "all" ? {} : { status }),
    ...(cursor ? { cursor } : {}),
  });
  const columns = useMemo(() => columnsFor(setAccepting), []);
  const rows = useMemo(() => [...(waitlist.data?.entries ?? [])], [waitlist.data]);
  const nextCursor = waitlist.data?.nextCursor;
  const filtered = Boolean(email) || status !== "all";
  return (
    <div className="grid min-w-0 gap-5">
      <Typography.Heading level={2} weight="medium" className="mb-3 text-2xl">
        Waitlist
      </Typography.Heading>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          aria-label="Search email"
          className="w-full sm:max-w-80"
          value={emailInput}
          onChange={(value) => {
            setEmailInput(value);
            setCursors([]);
          }}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search email…" />
            <SearchField.ClearButton aria-label="Clear email search" />
          </SearchField.Group>
        </SearchField>
        <Select
          aria-label="Filter by status"
          selectedKey={status}
          variant="secondary"
          className="w-full sm:w-44"
          onSelectionChange={(key) => {
            const filter = filters.find((item) => item.id === key);
            if (filter) {
              setStatus(filter.id);
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
      </div>
      {waitlist.error ? (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <p>Couldn’t load the waitlist.</p>
          <Button size="sm" variant="tertiary" onPress={waitlist.refetch}>
            Try again
          </Button>
        </div>
      ) : waitlist.isPending && !waitlist.data ? (
        <output className="text-muted text-sm">Loading waitlist…</output>
      ) : rows.length === 0 ? (
        <p className="text-muted py-12 text-center text-sm">
          {filtered
            ? "No entries match these filters."
            : cursors.length
              ? "No more entries. Go back to the previous page."
              : "No one has joined the waitlist yet."}
        </p>
      ) : (
        <DataGrid
          aria-label="Waitlist"
          columns={columns}
          data={rows}
          getRowId={getId}
          variant="secondary"
        />
      )}
      {cursors.length > 0 || nextCursor ? (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!cursors.length || waitlist.isFetching}
            onPress={() => setCursors((previous) => previous.slice(0, -1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!nextCursor || waitlist.isFetching}
            onPress={() => {
              if (nextCursor) setCursors((previous) => [...previous, nextCursor]);
            }}
          >
            Next
          </Button>
        </div>
      ) : null}
      {accepting ? (
        <AcceptWaitlistDialog entry={accepting} onClose={() => setAccepting(null)} />
      ) : null}
    </div>
  );
}
