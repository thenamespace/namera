// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import type { EnsLabel, WalletId } from "@namera-ai/protocol";
import type { WalletResponse } from "@namera-ai/protocol/dto";
import { ListBox, Select } from "@namera-ai/ui";
import { ShieldUserIcon, Wallet01Icon } from "@namera-ai/ui/icons";

import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { MetadataDisplay } from "@/components/display";
import { ResourceEmptyState } from "@/components/resource-empty-state";
import { useIdentities } from "@/hooks/identity";

import { IdentityProfile } from "./identity-profile";

export function IdentityHome({
  wallets,
  selected,
  canEdit,
}: {
  wallets: readonly WalletResponse[];
  selected: WalletResponse | undefined;
  canEdit: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-6">
      {selected ? (
        <>
          <Select
            aria-label="Account"
            selectedKey={selected.id}
            className="w-full sm:max-w-sm"
            onSelectionChange={(key) => {
              if (key) void navigate({ to: "/identity", search: { account: key as WalletId } });
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
          <AccountIdentity key={selected.id} wallet={selected} canEdit={canEdit} />
        </>
      ) : (
        <ResourceEmptyState
          icon={Wallet01Icon}
          title="No accounts yet"
          description="Give your account a name and a profile to share. Create an account to get started."
          actionLabel="Create account"
          onCreate={() => void navigate({ to: "/accounts/new" })}
        />
      )}
    </div>
  );
}

function AccountIdentity({ wallet, canEdit }: { wallet: WalletResponse; canEdit: boolean }) {
  const query = useIdentities(wallet.id);
  const [legacyLabel, setLegacyLabel] = useState<EnsLabel>();
  const navigate = useNavigate();
  if (query.isError) return <DataError label="identity" onRetry={query.refetch} />;
  if (!query.data) return <DataLoading label="Loading identity" />;
  const identities = query.data.items;
  const identity = identities.find((name) => name.label === legacyLabel) ?? identities[0];
  if (identity)
    return (
      <>
        {identities.length > 1 ? (
          <Select
            aria-label="Existing identity"
            selectedKey={identity.label}
            className="w-full sm:max-w-sm"
            onSelectionChange={(key) => {
              if (key) setLegacyLabel(key as EnsLabel);
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={identities}>
                {(name) => (
                  <ListBox.Item id={name.label} textValue={name.fullName}>
                    {name.fullName}
                  </ListBox.Item>
                )}
              </ListBox>
            </Select.Popover>
          </Select>
        ) : null}
        <IdentityProfile
          key={`${wallet.id}:${identity.label}`}
          wallet={wallet}
          label={identity.label}
          canEdit={canEdit}
        />
      </>
    );
  return (
    <div className="rounded-2xl border border-dashed border-separator">
      <ResourceEmptyState
        icon={ShieldUserIcon}
        title="Give this account an identity"
        description="Choose a namera.id name and create a public profile for your account. Share your name, not just an address."
        actionLabel="Create identity"
        onCreate={
          canEdit
            ? () => void navigate({ to: "/identity/new", search: { account: wallet.id } })
            : undefined
        }
      />
    </div>
  );
}
