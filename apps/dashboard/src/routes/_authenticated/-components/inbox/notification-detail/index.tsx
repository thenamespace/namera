import { Link } from "@tanstack/react-router";

import type { NotificationResponse } from "@namera-ai/protocol/dto";
import { buttonVariants } from "@namera-ai/ui";

import {
  WalletCreatedNotificationDetail,
  SessionKeyCreatedNotificationDetail,
  SessionKeyRevokedNotificationDetail,
  ExecutionConfirmedNotificationDetail,
} from "./account-details";
import {
  ApiKeyCreatedNotificationDetail,
  ApiKeyRevokedNotificationDetail,
  McpAuthorizationApprovedNotificationDetail,
  McpAuthorizationRevokedNotificationDetail,
  CliAuthorizationApprovedNotificationDetail,
  CliAuthorizationRevokedNotificationDetail,
} from "./authorization-details";
import { isNotification } from "./layout";
import {
  DetailList,
  DetailRow,
  InternalAction,
  NotificationDetailActions,
  NotificationDetailLayout,
  ResourceId,
  type NotificationOf,
} from "./layout";

export {
  WalletCreatedNotificationDetail,
  SessionKeyCreatedNotificationDetail,
  SessionKeyRevokedNotificationDetail,
  ExecutionConfirmedNotificationDetail,
} from "./account-details";
export {
  ApiKeyCreatedNotificationDetail,
  ApiKeyRevokedNotificationDetail,
  McpAuthorizationApprovedNotificationDetail,
  McpAuthorizationRevokedNotificationDetail,
  CliAuthorizationApprovedNotificationDetail,
  CliAuthorizationRevokedNotificationDetail,
} from "./authorization-details";

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

export function NotificationDetail({ item }: { readonly item: NotificationResponse }) {
  if (isNotification(item, "auth.account-changed")) {
    return (
      <NotificationDetailLayout
        item={item}
        description={`Google was ${item.notification.data.action === "linked" ? "connected" : "disconnected"}. Email sign-in remains available. If you did not make this change, review your connected accounts and active sessions.`}
      >
        <Link to="/settings/security" className={buttonVariants({ variant: "tertiary" })}>
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
