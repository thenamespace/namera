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
    <div className="grid min-h-12 grid-cols-[minmax(7rem,0.42fr)_minmax(0,1fr)] items-center gap-5 border-b border-separator py-2.5 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <Typography className="text-sm!" color="muted" weight="normal">
        {label}
      </Typography>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

type PropertyGroupProps = {
  title: string;
  children: ReactNode;
};

function PropertyGroup({ title, children }: PropertyGroupProps) {
  return (
    <section aria-labelledby={`account-${title.toLowerCase().replaceAll(" ", "-")}`}>
      <Typography.Heading
        className="mb-3 text-xs uppercase tracking-[0.12em] text-muted"
        id={`account-${title.toLowerCase().replaceAll(" ", "-")}`}
        level={3}
        weight="medium"
      >
        {title}
      </Typography.Heading>
      <div>{children}</div>
    </section>
  );
}

function TechnicalValue({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-xs text-foreground">{children}</span>;
}

const validatorLabels: Record<WalletResponse["data"]["validatorType"], string> = {
  webauthn_p256: "WebAuthn P-256",
  raw_p256: "Raw P-256",
  ecdsa_secp256k1: "ECDSA secp256k1",
};

const showAccountIdCopyError = () =>
  showErrorToast(undefined, { title: "Couldn't copy account ID" });
const showAccountIdCopySuccess = () => showSuccessToast({ title: "Account ID copied" });

type AccountOverviewProps = {
  account: WalletResponse;
};

export function AccountOverview({ account }: AccountOverviewProps) {
  const implementationVersion =
    account.implementation === "kernel" ? account.data.kernelVersion : account.data.safeVersion;
  const derivation =
    account.implementation === "kernel"
      ? { label: "Account index", value: account.data.accountIndex.toString() }
      : { label: "Salt nonce", value: account.data.saltNonce.toString() };

  return (
    <div className="grid gap-12">
      <PropertyGroup title="Properties">
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
      </PropertyGroup>

      <PropertyGroup title="Identifiers">
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
      </PropertyGroup>

      <PropertyGroup title="Smart account configuration">
        <Property label="Version">
          <TechnicalValue>{implementationVersion}</TechnicalValue>
        </Property>
        <Property label="Entry point">
          <TechnicalValue>{account.data.entryPointVersion}</TechnicalValue>
        </Property>
        <Property label="Validator">
          <span>{validatorLabels[account.data.validatorType]}</span>
        </Property>
        <Property label={derivation.label}>
          <TechnicalValue>{derivation.value}</TechnicalValue>
        </Property>
      </PropertyGroup>

      <PropertyGroup title="Timeline">
        <Property label="Created">
          <DateDisplay label="Created" value={account.createdAt} />
        </Property>
        <Property label="Last updated">
          <DateDisplay label="Last updated" value={account.updatedAt} />
        </Property>
      </PropertyGroup>
    </div>
  );
}

export type { AccountOverviewProps };
