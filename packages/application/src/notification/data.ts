import { Duration } from "effect";

import type { NotificationPreferenceTarget, NotificationType } from "@namera-ai/protocol/model";

interface NotificationPolicy {
  readonly target: NotificationPreferenceTarget;
  readonly emailDefaultEnabled: boolean;
  readonly emailTimeToLive: Duration.Duration;
}

export const notificationPolicy = {
  "auth.account-changed": {
    target: { category: "account", topic: "security" },
    emailDefaultEnabled: true,
    emailTimeToLive: Duration.days(1),
  },
  "auth.new-sign-in": {
    target: { category: "account", topic: "activity" },
    emailDefaultEnabled: true,
    emailTimeToLive: Duration.days(1),
  },
  "organization.invitation.received": {
    target: { category: "organization", topic: "invitations" },
    emailDefaultEnabled: true,
    emailTimeToLive: Duration.days(7),
  },
  "wallet.created": {
    target: { category: "organization", topic: "wallets" },
    emailDefaultEnabled: true,
    emailTimeToLive: Duration.days(7),
  },
  "session_key.created": {
    target: { category: "organization", topic: "session-keys" },
    emailDefaultEnabled: true,
    emailTimeToLive: Duration.days(7),
  },
  "session_key.revoked": {
    target: { category: "organization", topic: "session-keys" },
    emailDefaultEnabled: true,
    emailTimeToLive: Duration.days(7),
  },
  "api_key.created": {
    target: { category: "organization", topic: "api-keys" },
    emailDefaultEnabled: true,
    emailTimeToLive: Duration.days(7),
  },
  "api_key.revoked": {
    target: { category: "organization", topic: "api-keys" },
    emailDefaultEnabled: true,
    emailTimeToLive: Duration.days(7),
  },
  "execution.confirmed": {
    target: { category: "organization", topic: "executions" },
    emailDefaultEnabled: false,
    emailTimeToLive: Duration.days(7),
  },
  "mcp_authorization.approved": {
    target: { category: "organization", topic: "mcp-authorizations" },
    emailDefaultEnabled: false,
    emailTimeToLive: Duration.days(7),
  },
  "mcp_authorization.revoked": {
    target: { category: "organization", topic: "mcp-authorizations" },
    emailDefaultEnabled: false,
    emailTimeToLive: Duration.days(7),
  },
  "cli_authorization.approved": {
    target: { category: "organization", topic: "cli-authorizations" },
    emailDefaultEnabled: false,
    emailTimeToLive: Duration.days(7),
  },
  "cli_authorization.revoked": {
    target: { category: "organization", topic: "cli-authorizations" },
    emailDefaultEnabled: false,
    emailTimeToLive: Duration.days(7),
  },
} as const satisfies Readonly<Record<NotificationType, NotificationPolicy>>;

export const notificationPageSize = 30;
