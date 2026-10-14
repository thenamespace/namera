import {
  DetailList,
  DetailRow,
  InternalAction,
  NotificationDetailActions,
  NotificationDetailLayout,
  ResourceId,
  type NotificationOf,
} from "./layout";

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
