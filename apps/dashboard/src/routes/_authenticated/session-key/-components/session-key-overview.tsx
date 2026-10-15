import { useMemo } from "react";

import { Link } from "@tanstack/react-router";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import { CopyIconButton, IconPreview, Typography } from "@namera-ai/ui";

import { DetailProperty } from "@/components/detail-property";
import {
  DateDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  SessionKeyStatusDisplay,
} from "@/components/display";
import { SessionKeyCustodyDisplay } from "@/components/display/session-key-custody-display";
import { SessionKeyInstallations } from "@/components/session-key-installations";
import { SessionKeyActions } from "@/components/session-keys-table/actions";
import { sessionKeyCreatorPresentation } from "@/lib/session-key-creator";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const fallbackSessionKeyIcon: MetadataIcon = { type: "emoji", value: "🔑" };

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
            className="mt-3 max-w-full truncate text-3xl tracking-tight"
            level={2}
          >
            {sessionKey.metadata.name}
          </Typography.Heading>
          {sessionKey.metadata.description ? (
            <Typography.Paragraph className="mt-2 max-w-2xl text-muted" size="sm">
              {sessionKey.metadata.description}
            </Typography.Paragraph>
          ) : null}
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
          <DetailProperty label="Status">
            <SessionKeyStatusDisplay status={sessionKey.status} />
          </DetailProperty>
          <DetailProperty label="Account">
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
          </DetailProperty>
          <DetailProperty label="Custody">
            <SessionKeyCustodyDisplay custody={sessionKey.signer.custody} />
          </DetailProperty>
          <DetailProperty label="Namespace">
            <NamespaceDisplay namespace={sessionKey.namespace} />
          </DetailProperty>
          <DetailProperty label="Created by">
            <MetadataDisplay {...sessionKeyCreatorPresentation(sessionKey.creator)} />
          </DetailProperty>
          <DetailProperty label="Session key ID">
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
          </DetailProperty>
          <DetailProperty label="Created">
            <DateDisplay label="Created" value={sessionKey.createdAt} />
          </DetailProperty>
          {sessionKey.revokedAt ? (
            <DetailProperty label="Revoked">
              <DateDisplay label="Revoked" value={sessionKey.revokedAt} />
            </DetailProperty>
          ) : null}
        </div>
      </section>
      <SessionKeyInstallations key={sessionKey.id} sessionKey={sessionKey} />
    </div>
  );
}

export type { SessionKeyOverviewProps };
