import type { ReactNode } from "react";

import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";

import { CopyIconButton } from "@/components/copy-icon-button";
import {
  DateDisplay,
  EvmAddressDisplay,
  NamespaceDisplay,
  WalletImplementationDisplay,
  WalletProtectionDisplay,
  WalletStatusDisplay,
} from "@/components/display";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

type PropertyProps = {
  label: string;
  children: ReactNode;
};

function Property({ label, children }: PropertyProps) {
  return (
    <div className="grid min-h-9 grid-cols-[minmax(7rem,0.42fr)_minmax(0,1fr)] items-center gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <Typography className="text-sm!" color="muted" weight="normal">
        {label}
      </Typography>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

function TechnicalValue({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-xs text-foreground">{children}</span>;
}

const showAccountIdCopyError = () =>
  showErrorToast(undefined, { title: "Couldn't copy account ID" });
const showAccountIdCopySuccess = () => showSuccessToast({ title: "Account ID copied" });

type AccountOverviewProps = {
  account: WalletResponse;
};

export function AccountOverview({ account }: AccountOverviewProps) {
  return (
    <section aria-labelledby="account-properties" className="max-w-2xl">
      <Typography.Heading
        className="mb-4 text-sm text-muted"
        id="account-properties"
        level={3}
        weight="medium"
      >
        Properties
      </Typography.Heading>
      <div className="grid gap-2">
        <Property label="Status">
          <WalletStatusDisplay status={account.status} />
        </Property>
        <Property label="Namespace">
          <NamespaceDisplay namespace={account.namespace} />
        </Property>
        <Property label="Implementation">
          <WalletImplementationDisplay implementation={account.implementation} />
        </Property>
        <Property label="Protection">
          <WalletProtectionDisplay protectionLevel={account.protectionLevel} />
        </Property>
        <Property label="Address">
          <EvmAddressDisplay address={account.address} />
        </Property>
        <Property label="Account ID">
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
        </Property>
        <Property label="Created">
          <DateDisplay label="Created" value={account.createdAt} />
        </Property>
      </div>
    </section>
  );
}

export type { AccountOverviewProps };
