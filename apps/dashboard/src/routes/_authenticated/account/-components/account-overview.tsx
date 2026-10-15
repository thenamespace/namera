import type { ReactNode } from "react";

import type { WalletResponse } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import { CopyIconButton, IconPreview, Typography } from "@namera-ai/ui";

import { DetailProperty } from "@/components/detail-property";
import {
  DateDisplay,
  EvmAddressDisplay,
  NamespaceDisplay,
  WalletImplementationDisplay,
  WalletOwnerDisplay,
  WalletStatusDisplay,
} from "@/components/display";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const fallbackAccountIcon: MetadataIcon = { type: "emoji", value: "👛" };

function TechnicalValue({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-xs text-foreground">{children}</span>;
}

const showAccountIdCopyError = () =>
  showErrorToast(undefined, { title: "Couldn't copy account ID" });
const showAccountIdCopySuccess = () =>
  showSuccessToast({ title: "Account ID copied to clipboard" });

type AccountOverviewProps = {
  account: WalletResponse;
  variant?: "full" | "summary";
};

export function AccountOverview({ account, variant = "full" }: AccountOverviewProps) {
  return (
    <div className="mx-auto w-full max-w-5xl py-4 sm:px-2 sm:py-8">
      <header className="flex flex-col items-start">
        <IconPreview
          className="shrink-0 shadow-sm"
          size="lg"
          value={account.metadata.logo ?? fallbackAccountIcon}
        />
        <Typography.Heading className="mt-3 max-w-full truncate text-3xl tracking-tight" level={2}>
          {account.metadata.name}
        </Typography.Heading>
        {account.metadata.description ? (
          <Typography.Paragraph className="mt-2 max-w-2xl text-muted" size="sm">
            {account.metadata.description}
          </Typography.Paragraph>
        ) : null}
      </header>

      <section aria-labelledby="account-properties" className="mt-10 max-w-2xl">
        <Typography.Heading
          className="mb-4 text-sm text-muted"
          id="account-properties"
          level={3}
          weight="medium"
        >
          Properties
        </Typography.Heading>
        <div className="grid gap-2">
          {variant === "full" ? (
            <DetailProperty label="Status">
              <WalletStatusDisplay status={account.status} />
            </DetailProperty>
          ) : null}
          <DetailProperty label="Namespace">
            <NamespaceDisplay namespace={account.namespace} />
          </DetailProperty>
          <DetailProperty label="Implementation">
            <WalletImplementationDisplay implementation={account.implementation} />
          </DetailProperty>
          <DetailProperty label="Ownership">
            <WalletOwnerDisplay
              custody={account.owner.custody}
              provider={
                account.owner.custody === "namera-managed" ? account.owner.provider : undefined
              }
              protectionLevel={
                account.owner.custody === "namera-managed"
                  ? account.owner.protectionLevel
                  : undefined
              }
            />
          </DetailProperty>
          <DetailProperty label="Address">
            <EvmAddressDisplay address={account.address} />
          </DetailProperty>
          {variant === "full" ? (
            <>
              <DetailProperty label="Account ID">
                <div className="flex min-w-0 items-center gap-2">
                  <TechnicalValue>{account.id}</TechnicalValue>
                  <CopyIconButton
                    className="size-7"
                    label="Account ID"
                    value={account.id}
                    onCopyError={showAccountIdCopyError}
                    onCopySuccess={showAccountIdCopySuccess}
                  />
                </div>
              </DetailProperty>
              <DetailProperty label="Created">
                <DateDisplay label="Created" value={account.createdAt} />
              </DetailProperty>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export type { AccountOverviewProps };
