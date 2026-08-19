import { type ReactNode, useMemo } from "react";

import { Link } from "@tanstack/react-router";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import { IconPreview, Typography } from "@namera-ai/ui";

import { CopyIconButton } from "@/components/copy-icon-button";
import {
  DateDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  SessionKeyStatusDisplay,
} from "@/components/display";
import { SessionKeyActions } from "@/components/session-keys-table/actions";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const fallbackSessionKeyIcon: MetadataIcon = { type: "emoji", value: "🔑" };

type PropertyProps = {
  children: ReactNode;
  label: string;
};

function Property({ children, label }: PropertyProps) {
  return (
    <div className="grid min-h-9 grid-cols-[minmax(7rem,0.42fr)_minmax(0,1fr)] items-center gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <Typography className="text-sm!" color="muted" weight="normal">
        {label}
      </Typography>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

const showSessionKeyIdCopyError = () =>
  showErrorToast(undefined, { title: "Couldn't copy session key ID" });
const showSessionKeyIdCopySuccess = () => showSuccessToast({ title: "Session key ID copied" });

type SessionKeyOverviewProps = {
  sessionKey: SessionKeyResponse;
};

export function SessionKeyOverview({ sessionKey }: SessionKeyOverviewProps) {
  const accountParams = useMemo(
    () => ({ accountId: sessionKey.wallet.id }),
    [sessionKey.wallet.id],
  );

  return (
    <div className="mx-auto w-full max-w-5xl py-4 sm:px-2 sm:py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col items-start">
          <IconPreview
            className="shrink-0 shadow-sm"
            size="lg"
            value={sessionKey.metadata.logo ?? fallbackSessionKeyIcon}
          />
          <Typography.Heading
            className="mt-5 max-w-full truncate text-3xl tracking-tight"
            level={2}
          >
            {sessionKey.metadata.name}
          </Typography.Heading>
          <Typography.Paragraph className="mt-2 max-w-2xl text-muted" size="sm">
            {sessionKey.metadata.description ??
              "Scoped access for agents and integrations operating this account."}
          </Typography.Paragraph>
        </div>
        <SessionKeyActions sessionKey={sessionKey} showOpenAction={false} />
      </header>

      <section aria-labelledby="session-key-properties" className="mt-10 max-w-2xl">
        <Typography.Heading
          className="mb-4 text-sm text-muted"
          id="session-key-properties"
          level={3}
          weight="medium"
        >
          Properties
        </Typography.Heading>
        <div className="grid gap-2">
          <Property label="Status">
            <SessionKeyStatusDisplay status={sessionKey.status} />
          </Property>
          <Property label="Account">
            <Link
              className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              params={accountParams}
              to="/account/$accountId/overview"
            >
              <MetadataDisplay
                fallbackName="Unnamed account"
                metadata={sessionKey.wallet.metadata}
              />
            </Link>
          </Property>
          <Property label="Namespace">
            <NamespaceDisplay namespace={sessionKey.namespace} />
          </Property>
          <Property label="Created by">
            <MetadataDisplay
              fallbackName={sessionKey.creator.user.email}
              metadata={sessionKey.creator.user.metadata}
            />
          </Property>
          <Property label="Session key ID">
            <div className="flex min-w-0 items-center gap-2">
              <span className="break-all font-mono text-xs text-foreground">{sessionKey.id}</span>
              <CopyIconButton
                className="size-7"
                label="Session key ID"
                value={sessionKey.id}
                onCopyError={showSessionKeyIdCopyError}
                onCopySuccess={showSessionKeyIdCopySuccess}
              />
            </div>
          </Property>
          <Property label="Created">
            <DateDisplay label="Created" value={sessionKey.createdAt} />
          </Property>
          {sessionKey.revokedAt ? (
            <Property label="Revoked">
              <DateDisplay label="Revoked" value={sessionKey.revokedAt} />
            </Property>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export type { SessionKeyOverviewProps };
