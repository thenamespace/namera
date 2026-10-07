import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import { DateTime } from "effect";

import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type { NotificationResponse } from "@namera-ai/protocol/dto";
import type { NotificationType } from "@namera-ai/protocol/model";
import { buttonVariants, Surface, Typography } from "@namera-ai/ui";
import { ArrowUpRight01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { CopyIconButton } from "@/components/copy-icon-button";
import {
  ChainDisplay,
  EvmAddressDisplay,
  NamespaceDisplay,
  WalletImplementationDisplay,
  WalletOwnerDisplay,
} from "@/components/display";

import { notificationPresentation } from "./data";
import { NotificationIcon } from "./notification-icon";

type NotificationOf<Type extends NotificationType> = Extract<
  NotificationResponse,
  { readonly notification: { readonly type: Type } }
>;

function isNotification<Type extends NotificationType>(
  item: NotificationResponse,
  type: Type,
): item is NotificationOf<Type> {
  return item.notification.type === type;
}

type NotificationDetailLayoutProps = {
  readonly children: ReactNode;
  readonly description: string;
  readonly item: NotificationResponse;
};

function ResourceId({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-xs text-muted">{value}</span>
      <CopyIconButton className="size-6 min-h-6" label={label} value={value} />
    </div>
  );
}

function DetailRow({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="grid gap-1.5 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function DetailList({ children }: { readonly children: ReactNode }) {
  return (
    <Surface
      className="divide-y divide-separator overflow-hidden rounded-xl border"
      variant="secondary"
    >
      <dl>{children}</dl>
    </Surface>
  );
}

function NotificationDetailLayout({ children, description, item }: NotificationDetailLayoutProps) {
  const presentation = notificationPresentation[item.notification.type];
  const receivedAt = DateTime.formatLocal(item.receivedAt, {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex items-start gap-4">
        <NotificationIcon
          className="size-11 rounded-xl"
          iconClassName="size-5"
          type={item.notification.type}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <Typography.Heading className="text-xl tracking-tight" level={2}>
            {presentation.title}
          </Typography.Heading>
          <Typography className="mt-1 text-xs!" color="muted">
            {receivedAt}
          </Typography>
        </div>
      </header>

      <Typography.Paragraph className="mt-7 max-w-xl leading-6" color="muted" size="sm">
        {description}
      </Typography.Paragraph>

      <div className="mt-6">{children}</div>
    </article>
  );
}

function NotificationDetailActions({ children }: { readonly children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center gap-2">{children}</div>;
}

function InternalAction({
  children,
  paramName,
  paramValue,
  to,
}: {
  readonly children: ReactNode;
  readonly paramName?: "accountId" | "executionId" | "invitationId" | "sessionKeyId";
  readonly paramValue?: string;
  readonly to: string;
}) {
  const params =
    paramName === undefined || paramValue === undefined ? undefined : { [paramName]: paramValue };

  return (
    <Link
      className={buttonVariants({ size: "sm", variant: "secondary" })}
      to={to}
      {...(params === undefined ? {} : { params })}
    >
      {children}
    </Link>
  );
}

export function NewSignInNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"auth.new-sign-in">;
}) {
  return (
    <NotificationDetailLayout
      description="A new browser session signed in to your Namera account. Review the session details below and revoke it from Security if you do not recognize it."
      item={item}
    >
      <DetailList>
        <DetailRow label="IP address">
          {item.notification.data.ipAddress ?? "Unavailable"}
        </DetailRow>
        <DetailRow label="Device">
          <span className="line-clamp-2 text-muted">
            {item.notification.data.userAgent ?? "Browser details unavailable"}
          </span>
        </DetailRow>
        <DetailRow label="Session ID">
          <ResourceId label="Session ID" value={item.notification.resourceId} />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction to="/settings/security">Review active sessions</InternalAction>
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}

export function InvitationReceivedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"organization.invitation.received">;
}) {
  return (
    <NotificationDetailLayout
      description="You were invited to join a Namera workspace. Review the invitation before accepting access to its accounts and resources."
      item={item}
    >
      <DetailList>
        <DetailRow label="Invitation ID">
          <ResourceId label="Invitation ID" value={item.notification.resourceId} />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction
          paramName="invitationId"
          paramValue={item.notification.resourceId}
          to="/invitations/$invitationId"
        >
          Review invitation
        </InternalAction>
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}

export function WalletCreatedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"wallet.created">;
}) {
  return (
    <NotificationDetailLayout
      description="Your smart account was created successfully and is ready for session key setup."
      item={item}
    >
      <DetailList>
        <DetailRow label="Address">
          <EvmAddressDisplay address={item.notification.data.address} />
        </DetailRow>
        <DetailRow label="Implementation">
          <WalletImplementationDisplay implementation={item.notification.data.implementation} />
        </DetailRow>
        <DetailRow label="Ownership">
          <WalletOwnerDisplay
            custody={item.notification.data.custody}
            protectionLevel={
              item.notification.data.custody === "namera-managed"
                ? item.notification.data.protectionLevel
                : undefined
            }
          />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction
          paramName="accountId"
          paramValue={item.notification.resourceId}
          to="/account/$accountId/overview"
        >
          Open account
        </InternalAction>
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}

function SessionKeyNotificationDetail({
  item,
  revoked,
}: {
  readonly item: NotificationOf<"session_key.created"> | NotificationOf<"session_key.revoked">;
  readonly revoked: boolean;
}) {
  return (
    <NotificationDetailLayout
      description={
        revoked
          ? "Namera API, CLI, and MCP access for this session key was revoked, including its active grants. The local key can still exercise installed onchain permissions until the account owner removes them on each network. Open the session key to review removal status."
          : "A local session key was registered. Its onchain permissions require the account owner’s passkey approval before use. Additional API policies apply to operations sent through Namera."
      }
      item={item}
    >
      <DetailList>
        <DetailRow label="Namespace">
          <NamespaceDisplay namespace={item.notification.data.namespace} />
        </DetailRow>
        {item.notification.type === "session_key.created" ? (
          <DetailRow label="Policies">
            <div className="flex flex-wrap gap-1.5">
              {item.notification.data.policyTypes.map((policy) => (
                <span className="rounded-md bg-tertiary px-2 py-1 text-xs" key={policy}>
                  {policy.replace("evm.", "").replaceAll("-", " ")}
                </span>
              ))}
            </div>
          </DetailRow>
        ) : (
          <DetailRow label="Revoked grants">
            <span className="tabular-nums">{item.notification.data.revokedGrantCount}</span>
          </DetailRow>
        )}
        <DetailRow label="Session key ID">
          <ResourceId label="Session key ID" value={item.notification.resourceId} />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction
          paramName="sessionKeyId"
          paramValue={item.notification.resourceId}
          to="/session-key/$sessionKeyId/overview"
        >
          Open session key
        </InternalAction>
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}

export function SessionKeyCreatedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"session_key.created">;
}) {
  return <SessionKeyNotificationDetail item={item} revoked={false} />;
}

export function SessionKeyRevokedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"session_key.revoked">;
}) {
  return <SessionKeyNotificationDetail item={item} revoked />;
}

function ApiKeyNotificationDetail({
  item,
  revoked,
}: {
  readonly item: NotificationOf<"api_key.created"> | NotificationOf<"api_key.revoked">;
  readonly revoked: boolean;
}) {
  return (
    <NotificationDetailLayout
      description={
        revoked
          ? "This API key can no longer authenticate requests. Its session-key grants were revoked with it."
          : "A new API key can authenticate requests using the session keys granted when it was created."
      }
      item={item}
    >
      <DetailList>
        <DetailRow label={revoked ? "Revoked grants" : "Session keys"}>
          <span className="tabular-nums">{item.notification.data.sessionKeyCount}</span>
        </DetailRow>
        <DetailRow label="API key ID">
          <ResourceId label="API key ID" value={item.notification.resourceId} />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction to="/settings/workspace/api-keys">Manage API keys</InternalAction>
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}

export function ApiKeyCreatedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"api_key.created">;
}) {
  return <ApiKeyNotificationDetail item={item} revoked={false} />;
}

export function ApiKeyRevokedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"api_key.revoked">;
}) {
  return <ApiKeyNotificationDetail item={item} revoked />;
}

export function ExecutionConfirmedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"execution.confirmed">;
}) {
  const explorerUrl = getChainDataByCaip2(item.notification.data.chainId)?.chain.blockExplorers
    ?.default.url;
  const transactionUrl = explorerUrl
    ? `${explorerUrl.replace(/\/$/, "")}/tx/${item.notification.data.transactionHash}`
    : undefined;
  return (
    <NotificationDetailLayout
      description="The account operation was included onchain. Its confirmed transaction and execution record are available below."
      item={item}
    >
      <DetailList>
        <DetailRow label="Network">
          <ChainDisplay chainId={item.notification.data.chainId} />
        </DetailRow>
        <DetailRow label="Transaction hash">
          <ResourceId label="Transaction hash" value={item.notification.data.transactionHash} />
        </DetailRow>
        <DetailRow label="Execution ID">
          <ResourceId label="Execution ID" value={item.notification.resourceId} />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction
          paramName="executionId"
          paramValue={item.notification.resourceId}
          to="/execution/$executionId"
        >
          View execution
        </InternalAction>
        {transactionUrl === undefined ? null : (
          <a
            className={buttonVariants({ size: "sm", variant: "tertiary" })}
            href={transactionUrl}
            rel="noreferrer"
            target="_blank"
          >
            View on explorer
            <HugeiconsIcon className="size-3.5" icon={ArrowUpRight01Icon} />
          </a>
        )}
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}

function McpAuthorizationNotificationDetail({
  item,
  revoked,
}: {
  readonly item:
    | NotificationOf<"mcp_authorization.approved">
    | NotificationOf<"mcp_authorization.revoked">;
  readonly revoked: boolean;
}) {
  const count =
    item.notification.type === "mcp_authorization.approved"
      ? item.notification.data.sessionKeyCount
      : item.notification.data.revokedGrantCount;

  return (
    <NotificationDetailLayout
      description={
        revoked
          ? `${item.notification.data.clientName} can no longer use this workspace through MCP.`
          : `${item.notification.data.clientName} can now act through the session keys approved during authorization.`
      }
      item={item}
    >
      <DetailList>
        <DetailRow label="Client">{item.notification.data.clientName}</DetailRow>
        <DetailRow label={revoked ? "Revoked grants" : "Session keys"}>
          <span className="tabular-nums">{count}</span>
        </DetailRow>
        <DetailRow label="Authorization ID">
          <ResourceId label="Authorization ID" value={item.notification.resourceId} />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction to="/settings/workspace/mcp">Manage MCP access</InternalAction>
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}

export function McpAuthorizationApprovedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"mcp_authorization.approved">;
}) {
  return <McpAuthorizationNotificationDetail item={item} revoked={false} />;
}

export function McpAuthorizationRevokedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"mcp_authorization.revoked">;
}) {
  return <McpAuthorizationNotificationDetail item={item} revoked />;
}

function CliAuthorizationNotificationDetail({
  item,
  revoked,
}: {
  readonly item:
    | NotificationOf<"cli_authorization.approved">
    | NotificationOf<"cli_authorization.revoked">;
  readonly revoked: boolean;
}) {
  const count =
    item.notification.type === "cli_authorization.approved"
      ? item.notification.data.sessionKeyCount
      : item.notification.data.revokedGrantCount;

  return (
    <NotificationDetailLayout
      description={
        revoked
          ? `${item.notification.data.deviceName} can no longer use this workspace through the Namera CLI.`
          : `${item.notification.data.deviceName} can now act through the session keys approved during authorization.`
      }
      item={item}
    >
      <DetailList>
        <DetailRow label="Device">{item.notification.data.deviceName}</DetailRow>
        <DetailRow label={revoked ? "Revoked grants" : "Session keys"}>
          <span className="tabular-nums">{count}</span>
        </DetailRow>
        <DetailRow label="Authorization ID">
          <ResourceId label="Authorization ID" value={item.notification.resourceId} />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction to="/settings/workspace/cli-authorizations">
          Manage CLI access
        </InternalAction>
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}

export function CliAuthorizationApprovedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"cli_authorization.approved">;
}) {
  return <CliAuthorizationNotificationDetail item={item} revoked={false} />;
}

export function CliAuthorizationRevokedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"cli_authorization.revoked">;
}) {
  return <CliAuthorizationNotificationDetail item={item} revoked />;
}

export function NotificationDetail({ item }: { readonly item: NotificationResponse }) {
  if (isNotification(item, "auth.account-changed")) {
    return (
      <NotificationDetailLayout
        item={item}
        description={`Google was ${item.notification.data.action === "linked" ? "connected" : "disconnected"}. Email sign-in remains available. If you did not make this change, review your connected accounts and active sessions.`}
      >
        <Link to="/settings/security" className={buttonVariants({ variant: "secondary" })}>
          Review security
        </Link>
      </NotificationDetailLayout>
    );
  }
  if (isNotification(item, "auth.new-sign-in")) {
    return <NewSignInNotificationDetail item={item} />;
  }
  if (isNotification(item, "organization.invitation.received")) {
    return <InvitationReceivedNotificationDetail item={item} />;
  }
  if (isNotification(item, "wallet.created")) {
    return <WalletCreatedNotificationDetail item={item} />;
  }
  if (isNotification(item, "session_key.created")) {
    return <SessionKeyCreatedNotificationDetail item={item} />;
  }
  if (isNotification(item, "session_key.revoked")) {
    return <SessionKeyRevokedNotificationDetail item={item} />;
  }
  if (isNotification(item, "api_key.created")) {
    return <ApiKeyCreatedNotificationDetail item={item} />;
  }
  if (isNotification(item, "api_key.revoked")) {
    return <ApiKeyRevokedNotificationDetail item={item} />;
  }
  if (isNotification(item, "execution.confirmed")) {
    return <ExecutionConfirmedNotificationDetail item={item} />;
  }
  if (isNotification(item, "mcp_authorization.approved")) {
    return <McpAuthorizationApprovedNotificationDetail item={item} />;
  }
  if (isNotification(item, "mcp_authorization.revoked")) {
    return <McpAuthorizationRevokedNotificationDetail item={item} />;
  }
  if (isNotification(item, "cli_authorization.approved")) {
    return <CliAuthorizationApprovedNotificationDetail item={item} />;
  }

  return <CliAuthorizationRevokedNotificationDetail item={item} />;
}
