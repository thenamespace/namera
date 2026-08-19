import { type ReactNode, useMemo } from "react";

import { Link } from "@tanstack/react-router";

import { DateTime } from "effect";

import type { ExecutionDetailsResponse } from "@namera-ai/protocol/dto";
import { buttonVariants, cn, Typography } from "@namera-ai/ui";
import { ArrowUpRight01Icon, CheckmarkCircle02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { formatUnits } from "viem";

import { CopyIconButton } from "@/components/copy-icon-button";
import {
  ChainDisplay,
  DateDisplay,
  EvmAddressDisplay,
  ExecutionActorDisplay,
  MetadataDisplay,
  OAuthAuthorizationStatusDisplay,
  OAuthClientDisplay,
} from "@/components/display";
import { chainDataById } from "@/components/display/chain-display";

type DetailPropertyProps = {
  children: ReactNode;
  label: string;
};

function DetailProperty({ children, label }: DetailPropertyProps) {
  return (
    <div className="grid min-h-9 grid-cols-[minmax(7rem,0.42fr)_minmax(0,1fr)] items-start gap-5 py-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <Typography className="pt-0.5 text-sm!" color="muted" weight="normal">
        {label}
      </Typography>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

function TechnicalValue({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-xs text-foreground">{children}</span>;
}

function CopyableValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <TechnicalValue>{value}</TechnicalValue>
      <CopyIconButton className="-mt-1 size-7" label={label} value={value} />
    </div>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section aria-labelledby={`execution-${title.toLowerCase().replaceAll(" ", "-")}`}>
      <Typography.Heading
        className="mb-4 text-sm text-muted"
        id={`execution-${title.toLowerCase().replaceAll(" ", "-")}`}
        level={3}
        weight="medium"
      >
        {title}
      </Typography.Heading>
      <div className="grid gap-1">{children}</div>
    </section>
  );
}

function ActorDetails({ actor }: { actor: ExecutionDetailsResponse["actor"] }) {
  if (actor.type === "user") {
    return (
      <>
        <DetailProperty label="Called by">
          <ExecutionActorDisplay type={actor.type} />
        </DetailProperty>
        <DetailProperty label="Member">
          <MetadataDisplay
            fallbackName={actor.member.user.email}
            metadata={actor.member.user.metadata}
          />
        </DetailProperty>
        <DetailProperty label="Email">{actor.member.user.email}</DetailProperty>
        <DetailProperty label="Actor ID">
          <CopyableValue label="Actor ID" value={actor.id} />
        </DetailProperty>
      </>
    );
  }

  if (actor.type === "api-key") {
    const status =
      actor.apiKey.revokedAt !== null
        ? "Revoked"
        : actor.apiKey.expiresAt !== null &&
            DateTime.toEpochMillis(actor.apiKey.expiresAt) <= Date.now()
          ? "Expired"
          : "Active";
    return (
      <>
        <DetailProperty label="Called by">
          <ExecutionActorDisplay type={actor.type} />
        </DetailProperty>
        <DetailProperty label="API key">
          <MetadataDisplay fallbackName="Unnamed API key" metadata={actor.apiKey.metadata} />
        </DetailProperty>
        <DetailProperty label="Key prefix">
          <TechnicalValue>{actor.apiKey.keyStart}</TechnicalValue>
        </DetailProperty>
        <DetailProperty label="Status">{status}</DetailProperty>
        {actor.apiKey.expiresAt === null ? null : (
          <DetailProperty label="Expires">
            <DateDisplay label="Expires" value={actor.apiKey.expiresAt} />
          </DetailProperty>
        )}
        <DetailProperty label="API key ID">
          <CopyableValue label="API key ID" value={actor.apiKey.id} />
        </DetailProperty>
        {actor.apiKey.lastUsedAt === null ? null : (
          <DetailProperty label="Last used">
            <DateDisplay label="Last used" value={actor.apiKey.lastUsedAt} />
          </DetailProperty>
        )}
        <DetailProperty label="Actor ID">
          <CopyableValue label="Actor ID" value={actor.id} />
        </DetailProperty>
      </>
    );
  }

  const authorization = actor.authorization;
  return (
    <>
      <DetailProperty label="Called by">
        <ExecutionActorDisplay type={actor.type} />
      </DetailProperty>
      <DetailProperty label="Client">
        <OAuthClientDisplay client={authorization.client} />
      </DetailProperty>
      {authorization.metadata.type === "cli" ? (
        <DetailProperty label="Device">{authorization.metadata.deviceName}</DetailProperty>
      ) : null}
      <DetailProperty label="Status">
        <OAuthAuthorizationStatusDisplay status={authorization.status} />
      </DetailProperty>
      <DetailProperty label="Scopes">{authorization.scopes.join(", ")}</DetailProperty>
      <DetailProperty label="Resource">
        <TechnicalValue>{authorization.resource}</TechnicalValue>
      </DetailProperty>
      <DetailProperty label="Authorization ID">
        <CopyableValue label="Authorization ID" value={authorization.id} />
      </DetailProperty>
      {authorization.lastUsedAt === null ? null : (
        <DetailProperty label="Last used">
          <DateDisplay label="Last used" value={authorization.lastUsedAt} />
        </DetailProperty>
      )}
      {authorization.expiresAt === null ? null : (
        <DetailProperty label="Expires">
          <DateDisplay label="Expires" value={authorization.expiresAt} />
        </DetailProperty>
      )}
      <DetailProperty label="Actor ID">
        <CopyableValue label="Actor ID" value={actor.id} />
      </DetailProperty>
    </>
  );
}

type ExecutionDetailsProps = {
  details: ExecutionDetailsResponse;
};

export function ExecutionDetails({ details }: ExecutionDetailsProps) {
  const { actor, execution, sessionKey, wallet } = details;
  const { receipt } = execution.data;
  const chain = chainDataById.get(execution.data.chainId)?.chain;
  const explorerUrl = chain?.blockExplorers?.default.url?.replace(/\/$/, "");
  const transactionUrl = explorerUrl
    ? `${explorerUrl}/tx/${execution.data.transactionHash}`
    : undefined;
  const compactHash = `${execution.data.transactionHash.slice(0, 10)}…${execution.data.transactionHash.slice(-8)}`;
  const nativeCurrency = chain?.nativeCurrency;
  const accountParams = useMemo(() => ({ accountId: wallet.id }), [wallet.id]);
  const sessionKeyParams = useMemo(() => ({ sessionKeyId: sessionKey.id }), [sessionKey.id]);
  const calls = useMemo(() => {
    const occurrences = new Map<string, number>();
    return execution.data.calls.map((call) => {
      const identity = `${call.to}:${call.value}:${call.data}`;
      const occurrence = occurrences.get(identity) ?? 0;
      occurrences.set(identity, occurrence + 1);
      return { call, key: `${identity}:${occurrence}` };
    });
  }, [execution.data.calls]);
  const formatNative = (value: bigint | string) =>
    nativeCurrency === undefined
      ? `${value} wei`
      : `${formatUnits(BigInt(value), nativeCurrency.decimals)} ${nativeCurrency.symbol}`;

  return (
    <div className="mx-auto w-full max-w-5xl py-4 sm:px-2 sm:py-8">
      <header className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="bg-success-soft text-success-soft-foreground flex size-11 items-center justify-center rounded-lg">
            <HugeiconsIcon className="size-5" icon={CheckmarkCircle02Icon} />
          </div>
          <Typography.Heading className="mt-5 text-3xl tracking-tight" level={2}>
            Execution confirmed
          </Typography.Heading>
          <Typography.Paragraph className="mt-2 font-mono text-xs text-muted" size="sm">
            {compactHash}
          </Typography.Paragraph>
        </div>
        {transactionUrl === undefined ? null : (
          <a
            className={cn(buttonVariants({ size: "sm", variant: "tertiary" }), "shrink-0")}
            href={transactionUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            View transaction
            <HugeiconsIcon className="size-4" icon={ArrowUpRight01Icon} />
          </a>
        )}
      </header>

      <div className="mt-10 grid max-w-3xl gap-10">
        <DetailSection title="Overview">
          <DetailProperty label="Chain">
            <ChainDisplay chainId={execution.data.chainId} />
          </DetailProperty>
          <DetailProperty label="Account">
            <Link
              className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              params={accountParams}
              to="/account/$accountId/overview"
            >
              <MetadataDisplay fallbackName="Unnamed account" metadata={wallet.metadata} />
            </Link>
          </DetailProperty>
          <DetailProperty label="Session key">
            <Link
              className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              params={sessionKeyParams}
              to="/session-key/$sessionKeyId/overview"
            >
              <MetadataDisplay fallbackName="Unnamed session key" metadata={sessionKey.metadata} />
            </Link>
          </DetailProperty>
          <DetailProperty label="Called by">
            <ExecutionActorDisplay type={actor.type} />
          </DetailProperty>
          <DetailProperty label="Executed">
            <DateDisplay label="Executed" value={execution.createdAt} />
          </DetailProperty>
          <DetailProperty label="Execution ID">
            <CopyableValue label="Execution ID" value={execution.id} />
          </DetailProperty>
        </DetailSection>

        <DetailSection title="Transaction">
          <DetailProperty label="Transaction hash">
            <CopyableValue label="Transaction hash" value={execution.data.transactionHash} />
          </DetailProperty>
          <DetailProperty label="User operation">
            <CopyableValue label="User operation hash" value={execution.data.userOperationHash} />
          </DetailProperty>
          <DetailProperty label="Block">
            <TechnicalValue>{receipt.blockNumber}</TechnicalValue>
          </DetailProperty>
          <DetailProperty label="Sender">
            <EvmAddressDisplay address={receipt.sender} />
          </DetailProperty>
          <DetailProperty label="Entry point">
            <EvmAddressDisplay address={receipt.entryPoint} />
          </DetailProperty>
          <DetailProperty label="Paymaster">
            {receipt.paymaster === null ? (
              <Typography color="muted">None</Typography>
            ) : (
              <EvmAddressDisplay address={receipt.paymaster} />
            )}
          </DetailProperty>
          <DetailProperty label="Gas used">
            <TechnicalValue>{receipt.actualGasUsed}</TechnicalValue>
          </DetailProperty>
          <DetailProperty label="Gas cost">{formatNative(receipt.actualGasCost)}</DetailProperty>
        </DetailSection>

        <DetailSection title="Actor">
          <ActorDetails actor={actor} />
        </DetailSection>

        <DetailSection title={`Calls (${execution.data.calls.length})`}>
          {calls.map(({ call, key }, index) => (
            <div className="grid gap-1 py-2" key={key}>
              <DetailProperty label={`Call ${index + 1}`}>
                <EvmAddressDisplay address={call.to} />
              </DetailProperty>
              <DetailProperty label="Value">{formatNative(call.value)}</DetailProperty>
              <DetailProperty label="Data">
                <CopyableValue label={`Call ${index + 1} data`} value={call.data} />
              </DetailProperty>
            </div>
          ))}
        </DetailSection>
      </div>
    </div>
  );
}

export type { ExecutionDetailsProps };
