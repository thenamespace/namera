import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { WaitlistStatus } from "@namera-ai/protocol/model";
import { Button, SearchField, Table, Typography, toast } from "@namera-ai/ui";

import { client, run } from "@/api/client";
import { waitlistQuery } from "@/api/queries";
import { DataError, DataLoading, EmptyRows } from "@/components/data-states";
import { Pager } from "@/components/pager";
import { StatusLabel } from "@/components/status";
import { Timestamp } from "@/components/timestamp";
import { useCursorPages } from "@/lib/use-cursor-pages";

export const Route = createFileRoute("/_authed/waitlist")({ component: WaitlistScreen });

const statusFilters = ["all", "pending", "completed"] as const;

function WaitlistScreen() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("all");
  const [search, setSearch] = useState("");
  const pages = useCursorPages();

  const waitlist = useQuery(
    waitlistQuery({
      ...(status === "all" ? {} : { status }),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(pages.cursor ? { cursor: pages.cursor } : {}),
    }),
  );

  const setEntryStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: WaitlistStatus }) =>
      run(client.adminWaitlist.setStatus({ params: { id }, payload: { status: next } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success("Waitlist entry updated");
    },
    onError: () => toast.danger("Could not update that entry"),
  });

  const changeFilter = (apply: () => void) => {
    apply();
    pages.reset();
  };

  const entries = waitlist.data?.entries ?? [];
  const isFiltered = status !== "all" || search.trim().length > 0;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <Typography.Heading level={1} className="text-lg" weight="medium">
          Waitlist
        </Typography.Heading>
        <Typography.Paragraph color="muted" size="sm">
          Addresses that asked for access. Mark an entry completed once it has been invited.
        </Typography.Paragraph>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {statusFilters.map((option) => (
            <Button
              key={option}
              variant={status === option ? "secondary" : "tertiary"}
              onPress={() => changeFilter(() => setStatus(option))}
              aria-pressed={status === option}
            >
              <span className="capitalize">{option}</span>
            </Button>
          ))}
        </div>
        <SearchField
          aria-label="Filter the waitlist by email address"
          className="w-full sm:max-w-72"
          value={search}
          onChange={(value) => changeFilter(() => setSearch(value))}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter by email…" />
            <SearchField.ClearButton aria-label="Clear the waitlist filter" />
          </SearchField.Group>
        </SearchField>
      </div>

      {waitlist.isPending ? <DataLoading label="Loading the waitlist" /> : null}
      {waitlist.isError ? <DataError error={waitlist.error} onRetry={waitlist.refetch} /> : null}

      {waitlist.isSuccess && entries.length === 0 ? (
        <EmptyRows
          filtered={isFiltered}
          subject="waitlist entries"
          onClearFilters={() =>
            changeFilter(() => {
              setStatus("all");
              setSearch("");
            })
          }
        />
      ) : null}

      {waitlist.isSuccess && entries.length > 0 ? (
        <>
          <Table.ScrollContainer>
            <Table aria-label="Waitlist entries">
              <Table.Content>
                <Table.Header>
                  <Table.Column isRowHeader>Email</Table.Column>
                  <Table.Column>Status</Table.Column>
                  <Table.Column>Requested</Table.Column>
                  <Table.Column>Completed</Table.Column>
                  <Table.Column aria-label="Row actions" />
                </Table.Header>
                <Table.Body items={entries}>
                  {(entry) => (
                    <Table.Row id={entry.id}>
                      <Table.Cell>{entry.email}</Table.Cell>
                      <Table.Cell>
                        <StatusLabel status={entry.status} />
                      </Table.Cell>
                      <Table.Cell>
                        <Timestamp value={entry.createdAt} />
                      </Table.Cell>
                      <Table.Cell>
                        <Timestamp value={entry.completedAt} fallback="Not yet" />
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="tertiary"
                          isDisabled={setEntryStatus.isPending}
                          onPress={() =>
                            setEntryStatus.mutate({
                              id: entry.id,
                              next: entry.status === "completed" ? "pending" : "completed",
                            })
                          }
                        >
                          {entry.status === "completed" ? "Reopen" : "Mark completed"}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table>
          </Table.ScrollContainer>

          <Pager
            canGoBack={pages.canGoBack}
            isFetching={waitlist.isFetching}
            nextCursor={waitlist.data.nextCursor}
            onBack={pages.pop}
            onNext={() => waitlist.data.nextCursor && pages.push(waitlist.data.nextCursor)}
            shown={entries.length}
          />
        </>
      ) : null}
    </section>
  );
}
