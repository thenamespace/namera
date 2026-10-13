// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useMemo } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import type { WalletId } from "@namera-ai/protocol";
import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Button, ListBox, Select, Typography, buttonVariants } from "@namera-ai/ui";

import { DataError } from "@/components/data-error";
import { MetadataDisplay } from "@/components/display";
import { useIdentities } from "@/hooks/identity";

import { IdentityArtwork } from "./profile-artwork";

type Account = Pick<WalletResponse, "id" | "metadata" | "address">;
export function IdentityList({
  wallets,
  selected,
  canEdit,
  page,
}: {
  wallets: readonly Account[];
  selected: Account | undefined;
  canEdit: boolean;
  page: number;
}) {
  const navigate = useNavigate();
  const createSearch = useMemo(() => ({ account: selected?.id }), [selected?.id]);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <Typography.Heading level={1} className="text-lg">
            Identity
          </Typography.Heading>
          <Typography className="text-muted">
            A name and public profile for your account.
          </Typography>
        </div>
        {selected && canEdit ? (
          <Link to="/identity/new" search={createSearch} className={buttonVariants()}>
            Create identity
          </Link>
        ) : null}
      </div>
      {selected ? (
        <>
          <Select
            aria-label="Account"
            selectedKey={selected.id}
            className="w-full sm:max-w-sm"
            onSelectionChange={(key) => {
              if (key)
                void navigate({ to: "/identity", search: { account: key as WalletId, page: 1 } });
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={wallets}>
                {(wallet) => (
                  <ListBox.Item id={wallet.id} textValue={wallet.metadata.name}>
                    <MetadataDisplay metadata={wallet.metadata} fallbackName="Account" />
                  </ListBox.Item>
                )}
              </ListBox>
            </Select.Popover>
          </Select>
          <AccountIdentities
            key={selected.id}
            walletId={selected.id}
            page={page}
            canEdit={canEdit}
          />
        </>
      ) : (
        <div className="rounded-2xl border border-separator p-8 text-center">
          <Typography>Create an account before giving it an identity.</Typography>
          <Link
            to="/accounts"
            className={buttonVariants({ variant: "secondary", className: "mt-4" })}
          >
            View accounts
          </Link>
        </div>
      )}
    </div>
  );
}
function AccountIdentities({
  walletId,
  page,
  canEdit,
}: {
  walletId: WalletId;
  page: number;
  canEdit: boolean;
}) {
  const query = useIdentities(walletId, page);
  const createSearch = useMemo(() => ({ account: walletId }), [walletId]);
  const cards = useMemo(
    () =>
      query.data?.items.map((identity) => ({
        ...identity,
        params: { accountId: walletId, label: identity.label },
      })) ?? [],
    [query.data, walletId],
  );
  const navigate = useNavigate();
  if (query.isError) return <DataError label="identities" onRetry={query.refetch} />;
  if (!query.data) return <output>Loading identities…</output>;
  return (
    <>
      {query.data.items.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((identity) => {
            return (
              <Link
                key={identity.fullName}
                to="/identity/$accountId/$label"
                params={identity.params}
                className="overflow-hidden rounded-2xl border border-separator transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
              >
                <IdentityArtwork texts={identity.texts} name={identity.fullName} />
                <div className="grid gap-2 p-5 pt-2">
                  <Typography.Heading level={2} className="break-all text-base">
                    {identity.fullName}
                  </Typography.Heading>
                  <Typography className="line-clamp-2 text-muted">
                    {identity.texts.description || "Add a profile, links and payment addresses."}
                  </Typography>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-separator px-4 py-12">
          <Typography.Heading level={2} className="text-base">
            Give this account a name
          </Typography.Heading>
          <Typography className="text-center text-muted">
            Create a namera.id identity to share your profile and addresses.
          </Typography>
          {canEdit ? (
            <Link
              to="/identity/new"
              search={createSearch}
              className={buttonVariants({ variant: "secondary" })}
            >
              Create identity
            </Link>
          ) : null}
        </div>
      )}
      {query.data.totalItems > query.data.size || page > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="tertiary"
            isDisabled={page <= 1}
            onPress={() =>
              void navigate({ to: "/identity", search: { account: walletId, page: page - 1 } })
            }
          >
            Previous
          </Button>
          <Typography className="text-muted">Page {page}</Typography>
          <Button
            variant="tertiary"
            isDisabled={page * query.data.size >= query.data.totalItems}
            onPress={() =>
              void navigate({ to: "/identity", search: { account: walletId, page: page + 1 } })
            }
          >
            Next
          </Button>
        </div>
      ) : null}
    </>
  );
}
