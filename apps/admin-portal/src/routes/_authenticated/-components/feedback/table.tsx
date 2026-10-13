// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop
import { useMemo, useState } from "react";

import { Link } from "@tanstack/react-router";

import type { FeedbackView, ListFeedbackRequest } from "@namera-ai/protocol/dto";
import { Button, DataGrid, ListBox, Select, Typography, type DataGridColumn } from "@namera-ai/ui";

import { MemberDisplay } from "@/components/team-display";
import { useFeedback } from "@/hooks/feedback";

import {
  FeedbackDate,
  FeedbackOrganizationDisplay,
  FeedbackStatusDisplay,
  feedbackCategories,
  feedbackStatuses,
} from "./display";
import { FeedbackStatusActions } from "./status-actions";

const statusFilters = [{ id: "all", label: "All statuses" }, ...feedbackStatuses];
const categoryFilters = [{ id: "all", label: "All categories" }, ...feedbackCategories];
const getId = (entry: FeedbackView) => entry.id;
const columns: DataGridColumn<FeedbackView>[] = [
  { id: "author", header: "Name", width: 210, cell: (entry) => <MemberDisplay {...entry.user} /> },
  {
    id: "organization",
    header: "Organization",
    width: 180,
    cellClassName: "max-w-0",
    cell: (entry) => <FeedbackOrganizationDisplay organization={entry.organization} />,
  },
  {
    id: "message",
    header: "Message",
    isRowHeader: true,
    minWidth: 250,
    width: "1fr",
    cellClassName: "max-w-0",
    cell: (entry) => (
      <Link
        to="/feedback/$feedbackId"
        params={{ feedbackId: entry.id }}
        className="block truncate text-sm hover:underline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {entry.data.message}
      </Link>
    ),
  },
  {
    id: "category",
    header: "Category",
    width: 150,
    cell: (entry) => (
      <span className="text-sm">
        {feedbackCategories.find((option) => option.id === entry.category)?.label}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: 150,
    cell: (entry) => <FeedbackStatusDisplay status={entry.status} />,
  },
  {
    id: "created",
    header: "Submitted",
    width: 140,
    cell: (entry) => <FeedbackDate value={entry.createdAt} />,
  },
  {
    id: "actions",
    header: "",
    width: 48,
    pinned: "end",
    align: "end",
    cell: (entry) => <FeedbackStatusActions entry={entry} compact />,
  },
];

export function FeedbackTable() {
  const [status, setStatus] = useState<NonNullable<ListFeedbackRequest["status"]> | "all">("all");
  const [category, setCategory] = useState<NonNullable<ListFeedbackRequest["category"]> | "all">(
    "all",
  );
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const feedback = useFeedback({
    ...(status === "all" ? {} : { status }),
    ...(category === "all" ? {} : { category }),
    ...(cursor ? { cursor } : {}),
  });
  const rows = useMemo(() => [...(feedback.data?.entries ?? [])], [feedback.data]);
  const nextCursor = feedback.data?.nextCursor;
  const filtered = status !== "all" || category !== "all";
  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid gap-2">
        <Typography.Heading level={2} weight="medium" className="text-2xl">
          Feedback
        </Typography.Heading>
        <p className="text-muted text-sm">Read customer feedback and track what needs attention.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          aria-label="Filter by status"
          variant="secondary"
          className="w-full sm:w-44"
          selectedKey={status}
          onSelectionChange={(key) => {
            const option = feedbackStatuses.find((item) => item.id === key);
            setStatus(option?.id ?? "all");
            setCursors([]);
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox items={statusFilters}>
              {(option) => (
                <ListBox.Item id={option.id} textValue={option.label}>
                  {option.label}
                </ListBox.Item>
              )}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          aria-label="Filter by category"
          variant="secondary"
          className="w-full sm:w-48"
          selectedKey={category}
          onSelectionChange={(key) => {
            const option = feedbackCategories.find((item) => item.id === key);
            setCategory(option?.id ?? "all");
            setCursors([]);
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox items={categoryFilters}>
              {(option) => (
                <ListBox.Item id={option.id} textValue={option.label}>
                  {option.label}
                </ListBox.Item>
              )}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      {feedback.error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <p>Couldn’t load feedback.</p>
          <Button size="sm" variant="tertiary" onPress={feedback.refetch}>
            Try again
          </Button>
        </div>
      ) : feedback.isPending && !feedback.data ? (
        <output className="text-muted text-sm">Loading feedback…</output>
      ) : rows.length === 0 ? (
        <div className="grid justify-items-center gap-3 py-12 text-sm text-muted">
          <p>
            {filtered
              ? "No feedback matches these filters."
              : cursors.length
                ? "No more feedback. Go back to the previous page."
                : "No feedback yet. Submissions from the dashboard will appear here."}
          </p>
          {filtered ? (
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => {
                setStatus("all");
                setCategory("all");
                setCursors([]);
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <DataGrid
            aria-label="Customer feedback"
            columns={columns}
            data={rows}
            getRowId={getId}
            variant="secondary"
          />
        </div>
      )}
      {cursors.length > 0 || nextCursor ? (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!cursors.length || feedback.isFetching}
            onPress={() => setCursors((previous) => previous.slice(0, -1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!nextCursor || feedback.isFetching}
            onPress={() => {
              if (nextCursor) setCursors((previous) => [...previous, nextCursor]);
            }}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
