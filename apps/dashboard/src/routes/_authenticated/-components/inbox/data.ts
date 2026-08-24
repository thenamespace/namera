import { DateTime } from "effect";

import type { NotificationResponse } from "@namera-ai/protocol/dto";
import type { NotificationType } from "@namera-ai/protocol/model";
import {
  Activity01Icon,
  ApiIcon,
  BotIcon,
  Key01Icon,
  SecurityIcon,
  TerminalIcon,
  UserMultiple02Icon,
  Wallet01Icon,
  type IconSvgElement,
} from "@namera-ai/ui/icons";

export type InboxNotificationGroup = "access" | "accounts" | "activity" | "security";

export type InboxNotificationPresentation = {
  readonly group: InboxNotificationGroup;
  readonly icon: IconSvgElement;
  readonly preview: string;
  readonly title: string;
};

export const inboxGroupOptions = [
  { id: "security", label: "Security", icon: SecurityIcon },
  { id: "accounts", label: "Accounts", icon: Wallet01Icon },
  { id: "access", label: "Access", icon: Key01Icon },
  { id: "activity", label: "Activity", icon: Activity01Icon },
] as const;

export const notificationPresentation = {
  "auth.new-sign-in": {
    group: "security",
    icon: SecurityIcon,
    title: "New sign-in detected",
    preview: "A new browser session signed in to your account.",
  },
  "organization.invitation.received": {
    group: "access",
    icon: UserMultiple02Icon,
    title: "Workspace invitation",
    preview: "You were invited to join a Namera workspace.",
  },
  "wallet.created": {
    group: "accounts",
    icon: Wallet01Icon,
    title: "Account created",
    preview: "Your smart account is ready to use.",
  },
  "session_key.created": {
    group: "access",
    icon: Key01Icon,
    title: "Session key created",
    preview: "A new policy-bound session key can access an account.",
  },
  "session_key.revoked": {
    group: "access",
    icon: Key01Icon,
    title: "Session key revoked",
    preview: "A session key and its active grants were revoked.",
  },
  "api_key.created": {
    group: "access",
    icon: ApiIcon,
    title: "API key created",
    preview: "A new API key was granted access to session keys.",
  },
  "api_key.revoked": {
    group: "access",
    icon: ApiIcon,
    title: "API key revoked",
    preview: "An API key and its session-key grants were revoked.",
  },
  "execution.confirmed": {
    group: "activity",
    icon: Activity01Icon,
    title: "Execution confirmed",
    preview: "An account operation was confirmed onchain.",
  },
  "mcp_authorization.approved": {
    group: "access",
    icon: BotIcon,
    title: "MCP access approved",
    preview: "An MCP client can now use the selected session keys.",
  },
  "mcp_authorization.revoked": {
    group: "access",
    icon: BotIcon,
    title: "MCP access revoked",
    preview: "An MCP client's active session-key grants were revoked.",
  },
  "cli_authorization.approved": {
    group: "access",
    icon: TerminalIcon,
    title: "CLI access approved",
    preview: "A CLI device can now use the selected session keys.",
  },
  "cli_authorization.revoked": {
    group: "access",
    icon: TerminalIcon,
    title: "CLI access revoked",
    preview: "A CLI device's active session-key grants were revoked.",
  },
} as const satisfies Readonly<Record<NotificationType, InboxNotificationPresentation>>;

export function formatNotificationTime(value: NotificationResponse["receivedAt"]): string {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - DateTime.toEpochMillis(value)) / 1000),
  );

  if (elapsedSeconds < 60) return "Now";
  if (elapsedSeconds < 3_600) return `${Math.floor(elapsedSeconds / 60)}m`;
  if (elapsedSeconds < 86_400) return `${Math.floor(elapsedSeconds / 3_600)}h`;
  if (elapsedSeconds < 604_800) return `${Math.floor(elapsedSeconds / 86_400)}d`;

  return DateTime.formatLocal(value, { day: "numeric", month: "short" });
}

export function notificationSearchText(item: NotificationResponse): string {
  const presentation = notificationPresentation[item.notification.type];
  return [
    presentation.title,
    presentation.preview,
    item.notification.type,
    item.notification.resourceType,
    item.notification.resourceId,
  ]
    .join(" ")
    .toLowerCase();
}
