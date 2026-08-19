import type { NotificationInboxItem } from "@namera-ai/database";
import type { NotificationResponse } from "@namera-ai/protocol/dto";

export const toNotificationResponse = (input: NotificationInboxItem): NotificationResponse => {
  switch (input.notification.type) {
    case "auth.new-sign-in":
      return toResponse(input.notification, input.recipient);
    case "organization.invitation.received":
      return toResponse(input.notification, input.recipient);
    case "wallet.created":
      return toResponse(input.notification, input.recipient);
    case "session_key.created":
      return toResponse(input.notification, input.recipient);
    case "session_key.revoked":
      return toResponse(input.notification, input.recipient);
    case "api_key.created":
      return toResponse(input.notification, input.recipient);
    case "api_key.revoked":
      return toResponse(input.notification, input.recipient);
    case "execution.confirmed":
      return toResponse(input.notification, input.recipient);
    case "mcp_authorization.approved":
      return toResponse(input.notification, input.recipient);
    case "mcp_authorization.revoked":
      return toResponse(input.notification, input.recipient);
    case "cli_authorization.approved":
      return toResponse(input.notification, input.recipient);
    case "cli_authorization.revoked":
      return toResponse(input.notification, input.recipient);
  }
};

const toResponse = <Notification extends NotificationInboxItem["notification"]>(
  notification: Notification,
  recipient: NotificationInboxItem["recipient"],
) => ({
  notification,
  readAt: recipient.readAt,
  receivedAt: recipient.receivedAt,
});
