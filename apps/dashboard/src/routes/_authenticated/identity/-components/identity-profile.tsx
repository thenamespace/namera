// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useMemo, useState } from "react";

import { Link } from "@tanstack/react-router";

import type { EnsLabel } from "@namera-ai/protocol";
import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Button, Typography } from "@namera-ai/ui";
import { ArrowLeft01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { DataError } from "@/components/data-error";
import { MetadataDisplay } from "@/components/display";
import { useIdentity, useIdentityNetworks } from "@/hooks/identity";

import { PrimaryName } from "./primary-name";
import { IdentityArtwork } from "./profile-artwork";
import { ProfileDialog } from "./profile-dialog";
import { RecordDialog, type RecordDraft } from "./record-dialog";

export function IdentityProfile({
  wallet,
  label,
  canEdit,
}: {
  wallet: WalletResponse;
  label: EnsLabel;
  canEdit: boolean;
}) {
  const query = useIdentity(wallet.id, label);
  const networks = useIdentityNetworks();
  const [editing, setEditing] = useState(false);
  const [record, setRecord] = useState<RecordDraft>();
  const listSearch = useMemo(() => ({ account: wallet.id, page: 1 }), [wallet.id]);
  const accountParams = useMemo(() => ({ accountId: wallet.id }), [wallet.id]);
  if (query.isError) return <DataError label="identity" onRetry={query.refetch} />;
  if (!query.data) return <output>Loading identity…</output>;
  const identity = query.data;
  return (
    <article className="grid gap-6">
      <Link
        to="/identity"
        search={listSearch}
        className="flex w-fit items-center gap-2 text-sm text-muted hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
        All identities
      </Link>
      <section className="overflow-hidden rounded-2xl border border-separator">
        <IdentityArtwork texts={identity.texts} name={identity.fullName} />
        <div className="grid gap-5 px-5 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Typography.Heading level={1} className="break-all text-2xl">
                {identity.fullName}
              </Typography.Heading>
              {identity.texts.name ? (
                <Typography className="mt-2">{identity.texts.name}</Typography>
              ) : null}
            </div>
            {canEdit ? (
              <Button variant="secondary" onPress={() => setEditing(true)}>
                Edit profile
              </Button>
            ) : null}
          </div>
          {identity.texts.description ? (
            <Typography className="whitespace-pre-wrap break-words text-muted">
              {identity.texts.description}
            </Typography>
          ) : null}
          <div className="grid gap-2 border-t border-separator pt-4">
            <Typography className="text-xs text-muted">Owned by account</Typography>
            <Link to="/account/$accountId/overview" params={accountParams}>
              <MetadataDisplay metadata={wallet.metadata} fallbackName="Account" />
            </Link>
            <Typography className="break-all text-xs text-muted">{identity.owner}</Typography>
          </div>
        </div>
      </section>
      <PrimaryName wallet={wallet} label={label} canEdit={canEdit} />
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <Typography.Heading level={2} className="text-base">
            Addresses
          </Typography.Heading>
          {canEdit ? (
            <Button
              variant="tertiary"
              onPress={() => setRecord({ type: "address", key: "", value: "", existing: false })}
            >
              Add address
            </Button>
          ) : null}
        </div>
        <div className="divide-y divide-separator rounded-2xl border border-separator">
          {Object.entries(identity.addresses).map(([coin, value]) => {
            const network = networks.data?.find((entry) => entry.coinType === coin);
            return (
              <div key={coin} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Typography className="text-sm font-medium">
                    {network?.label ?? `Coin type ${coin}`}
                  </Typography>
                  <Typography className="break-all text-sm text-muted">{value}</Typography>
                </div>
                {canEdit && network ? (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onPress={() =>
                      setRecord({ type: "address", key: network.key, value, existing: true })
                    }
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
            );
          })}
          {!Object.keys(identity.addresses).length ? (
            <Typography className="p-4 text-muted">No addresses yet.</Typography>
          ) : null}
        </div>
      </section>
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <Typography.Heading level={2} className="text-base">
            Text records
          </Typography.Heading>
          {canEdit ? (
            <Button
              variant="tertiary"
              onPress={() => setRecord({ type: "text", key: "", value: "", existing: false })}
            >
              Add record
            </Button>
          ) : null}
        </div>
        <div className="divide-y divide-separator rounded-2xl border border-separator">
          {Object.entries(identity.texts).map(([key, value]) => (
            <div key={key} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <Typography className="text-sm font-medium">{key}</Typography>
                <Typography className="whitespace-pre-wrap break-words text-sm text-muted">
                  {value}
                </Typography>
              </div>
              {canEdit ? (
                <Button
                  variant="tertiary"
                  size="sm"
                  onPress={() => setRecord({ type: "text", key, value, existing: true })}
                >
                  Edit
                </Button>
              ) : null}
            </div>
          ))}
          {!Object.keys(identity.texts).length ? (
            <Typography className="p-4 text-muted">No text records yet.</Typography>
          ) : null}
        </div>
      </section>
      <details className="rounded-2xl border border-separator p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Advanced · JSON data records
        </summary>
        <div className="mt-4 grid gap-3">
          {Object.entries(identity.records).map(([key, value]) => (
            <div key={key} className="grid gap-2 rounded-xl bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <Typography className="break-all text-sm">{key}</Typography>
                {canEdit ? (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onPress={() =>
                      setRecord({
                        type: "data",
                        key,
                        value: JSON.stringify(value, null, 2),
                        existing: true,
                      })
                    }
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all text-xs text-muted">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
          {canEdit ? (
            <Button
              variant="tertiary"
              onPress={() => setRecord({ type: "data", key: "", value: "{}", existing: false })}
            >
              Add JSON record
            </Button>
          ) : null}
        </div>
      </details>
      {editing ? (
        <ProfileDialog
          walletId={wallet.id}
          identity={identity}
          onClose={() => setEditing(false)}
          onRefresh={query.refetch}
        />
      ) : null}
      {record ? (
        <RecordDialog
          walletId={wallet.id}
          label={label}
          draft={record}
          onClose={() => setRecord(undefined)}
          onRefresh={query.refetch}
        />
      ) : null}
    </article>
  );
}
