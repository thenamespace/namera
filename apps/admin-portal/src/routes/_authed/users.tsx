import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { SearchField, Table, Typography } from "@namera-ai/ui";

import { usersQuery } from "@/api/queries";
import { DataError, DataLoading, EmptyRows } from "@/components/data-states";
import { Pager } from "@/components/pager";
import { Timestamp } from "@/components/timestamp";
import { useCursorPages } from "@/lib/use-cursor-pages";

export const Route = createFileRoute("/_authed/users")({ component: UsersScreen });

function UsersScreen() {
  const [search, setSearch] = useState("");
  const pages = useCursorPages();

  const users = useQuery(
    usersQuery({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(pages.cursor ? { cursor: pages.cursor } : {}),
    }),
  );

  const entries = users.data?.entries ?? [];
  const isFiltered = search.trim().length > 0;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <Typography.Heading level={1} className="text-lg" weight="medium">
          Users
        </Typography.Heading>
        <Typography.Paragraph color="muted" size="sm">
          Accounts that completed sign-in, newest first.
        </Typography.Paragraph>
      </header>

      <SearchField
        aria-label="Filter users by email address or name"
        className="w-full sm:max-w-72"
        value={search}
        onChange={(value) => {
          setSearch(value);
          pages.reset();
        }}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Filter by email or name…" />
          <SearchField.ClearButton aria-label="Clear the user filter" />
        </SearchField.Group>
      </SearchField>

      {users.isPending ? <DataLoading label="Loading users" /> : null}
      {users.isError ? <DataError error={users.error} onRetry={users.refetch} /> : null}

      {users.isSuccess && entries.length === 0 ? (
        <EmptyRows
          filtered={isFiltered}
          subject="users"
          onClearFilters={() => {
            setSearch("");
            pages.reset();
          }}
        />
      ) : null}

      {users.isSuccess && entries.length > 0 ? (
        <>
          <Table.ScrollContainer>
            <Table aria-label="User accounts">
              <Table.Content>
                <Table.Header>
                  <Table.Column isRowHeader>Email</Table.Column>
                  <Table.Column>Name</Table.Column>
                  <Table.Column>Verified</Table.Column>
                  <Table.Column>Last sign-in</Table.Column>
                  <Table.Column>Joined</Table.Column>
                </Table.Header>
                <Table.Body items={entries}>
                  {(entry) => (
                    <Table.Row id={entry.id}>
                      <Table.Cell>{entry.email}</Table.Cell>
                      <Table.Cell>
                        {entry.name ?? <span className="text-muted">Not set</span>}
                      </Table.Cell>
                      <Table.Cell>
                        {entry.emailVerified ? "Yes" : <span className="text-muted">No</span>}
                      </Table.Cell>
                      <Table.Cell>
                        <Timestamp value={entry.lastLoginAt} />
                      </Table.Cell>
                      <Table.Cell>
                        <Timestamp value={entry.createdAt} />
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table>
          </Table.ScrollContainer>

          <Pager
            canGoBack={pages.canGoBack}
            isFetching={users.isFetching}
            nextCursor={users.data.nextCursor}
            onBack={pages.pop}
            onNext={() => users.data.nextCursor && pages.push(users.data.nextCursor)}
            shown={entries.length}
          />
        </>
      ) : null}
    </section>
  );
}
