import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { BetaInviteStatus } from "@namera-ai/protocol/model";
import { Button, SearchField, Table, Typography, toast } from "@namera-ai/ui";

import { client, run } from "@/api/client";
import { invitesQuery } from "@/api/queries";
import { DataError, DataLoading, EmptyRows } from "@/components/data-states";
import { LinkButton } from "@/components/link-button";
import { Pager } from "@/components/pager";
import { StatusLabel, inviteStatuses } from "@/components/status";
import { Timestamp } from "@/components/timestamp";
import { useCursorPages } from "@/lib/use-cursor-pages";

export const Route = createFileRoute("/_authed/invites/")({ component: InvitesScreen });

function InvitesScreen() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<BetaInviteStatus | "all">("all");
  const [email, setEmail] = useState("");
  const pages = useCursorPages();

  const filters = {
    ...(status === "all" ? {} : { status }),
    ...(email.trim() ? { email: email.trim() } : {}),
    ...(pages.cursor ? { cursor: pages.cursor } : {}),
  };
  const invites = useQuery(invitesQuery(filters));

  const revoke = useMutation({
    mutationFn: (id: string) => run(client.betaInvite.revoke({ params: { id } })),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["invites"] });
      if (result.revoked) toast.success("Invite revoked");
      else
        toast.warning("Nothing to revoke", {
          description: "That invite was already redeemed or revoked.",
        });
    },
    onError: () => toast.danger("Could not revoke that invite"),
  });

  const changeFilter = (apply: () => void) => {
    apply();
    pages.reset();
  };

  const isFiltered = status !== "all" || email.trim().length > 0;
  const entries = invites.data?.entries ?? [];

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Typography.Heading level={1} className="text-lg" weight="medium">
            Invites
          </Typography.Heading>
          <Typography.Paragraph color="muted" size="sm">
            Codes are shown once, when they are created. Only the hash is stored.
          </Typography.Paragraph>
        </div>
        <LinkButton to="/invites/new">Create invites</LinkButton>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {(["all", ...inviteStatuses] as const).map((option) => (
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
          aria-label="Filter invites by the email the invite was issued to"
          className="w-full sm:max-w-72"
          value={email}
          onChange={(value) => changeFilter(() => setEmail(value))}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Filter by email…" />
            <SearchField.ClearButton aria-label="Clear the email filter" />
          </SearchField.Group>
        </SearchField>
      </div>

      {invites.isPending ? <DataLoading label="Loading invites" /> : null}
      {invites.isError ? <DataError error={invites.error} onRetry={invites.refetch} /> : null}

      {invites.isSuccess && entries.length === 0 ? (
        <EmptyRows
          filtered={isFiltered}
          subject="invites"
          onClearFilters={() =>
            changeFilter(() => {
              setStatus("all");
              setEmail("");
            })
          }
        />
      ) : null}

      {invites.isSuccess && entries.length > 0 ? (
        <>
          <Table.ScrollContainer>
            <Table aria-label="Beta invites">
              <Table.Content>
                <Table.Header>
                  <Table.Column isRowHeader>Status</Table.Column>
                  <Table.Column>Issued to</Table.Column>
                  <Table.Column>Created</Table.Column>
                  <Table.Column>Expires</Table.Column>
                  <Table.Column>Redeemed by</Table.Column>
                  <Table.Column aria-label="Row actions" />
                </Table.Header>
                <Table.Body items={entries}>
                  {(entry) => (
                    <Table.Row id={entry.id}>
                      <Table.Cell>
                        <StatusLabel status={entry.status} />
                      </Table.Cell>
                      <Table.Cell>
                        {entry.email ?? <span className="text-muted">Anyone</span>}
                      </Table.Cell>
                      <Table.Cell>
                        <Timestamp value={entry.createdAt} />
                      </Table.Cell>
                      <Table.Cell>
                        <Timestamp value={entry.expiresAt} />
                      </Table.Cell>
                      <Table.Cell>
                        {entry.redeemedByEmail ?? <span className="text-muted">Not redeemed</span>}
                      </Table.Cell>
                      <Table.Cell>
                        {entry.status === "active" ? (
                          <Button
                            variant="tertiary"
                            isDisabled={revoke.isPending}
                            onPress={() => revoke.mutate(entry.id)}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table>
          </Table.ScrollContainer>

          <Pager
            canGoBack={pages.canGoBack}
            isFetching={invites.isFetching}
            nextCursor={invites.data.nextCursor}
            onBack={pages.pop}
            onNext={() => invites.data.nextCursor && pages.push(invites.data.nextCursor)}
            shown={entries.length}
          />
        </>
      ) : null}
    </section>
  );
}
