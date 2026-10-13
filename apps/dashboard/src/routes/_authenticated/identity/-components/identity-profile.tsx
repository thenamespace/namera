// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import type { EnsLabel } from "@namera-ai/protocol";
import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Button, Typography } from "@namera-ai/ui";

import { sessionAuthority } from "@/atoms/auth/authority";
import { CopyIconButton } from "@/components/copy-icon-button";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { EvmAddressDisplay } from "@/components/display";
import { useCurrentUser } from "@/hooks/auth/session";
import { useIdentity, useIdentityNetworks } from "@/hooks/identity";
import { supportsSessionKeys } from "@/lib/session-owner";

import { ArtworkEditor } from "./artwork-editor";
import { PrimaryName } from "./primary-name";
import { IdentityArtwork } from "./profile-artwork";
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
  const actor = useCurrentUser().data;
  const networks = useIdentityNetworks();
  const [record, setRecord] = useState<RecordDraft>();
  const [artworkActions, setArtworkActions] = useState<HTMLDivElement | null>(null);
  if (query.isError) return <DataError label="identity" onRetry={query.refetch} />;
  if (!query.data) return <DataLoading label="Loading identity" />;
  const identity = query.data;
  return (
    <article className="grid gap-6">
      <section className="overflow-hidden rounded-xl border border-separator">
        {canEdit &&
        actor?.role.type === "system" &&
        actor.role.key === "owner" &&
        supportsSessionKeys(wallet) ? (
          <ArtworkEditor
            key={`${sessionAuthority(actor)}:${wallet.id}:${label}`}
            wallet={wallet}
            label={label}
            texts={identity.texts}
            name={identity.fullName}
            actionsContainer={artworkActions}
          />
        ) : (
          <IdentityArtwork texts={identity.texts} name={identity.fullName} />
        )}
        <div className="grid gap-5 px-5 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Typography.Heading level={1} className="min-w-0 break-all text-2xl">
                  {identity.fullName}
                </Typography.Heading>
                <CopyIconButton label="Name" value={identity.fullName} className="shrink-0" />
              </div>
              {identity.texts.name ? (
                <Typography className="mt-2">{identity.texts.name}</Typography>
              ) : null}
            </div>
            <PrimaryName wallet={wallet} label={label} canEdit={canEdit} />
          </div>
          {identity.texts.description ? (
            <Typography className="whitespace-pre-wrap break-words text-muted">
              {identity.texts.description}
            </Typography>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border-t border-separator pt-4">
            <Typography className="text-xs text-muted">Owned by</Typography>
            <EvmAddressDisplay address={identity.owner} size="sm" />
            <div ref={setArtworkActions} className="ml-auto" />
          </div>
        </div>
      </section>
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
        <div className="divide-y divide-separator rounded-xl border border-separator">
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
        <div className="divide-y divide-separator rounded-xl border border-separator">
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
