import { Duration } from "effect";

import type { NotificationPreferenceTarget, NotificationType } from "@namera-ai/protocol/model";

interface NotificationPolicy {
  readonly target: NotificationPreferenceTarget;
  readonly emailDefaultEnabled: boolean;
  readonly emailTimeToLive: Duration.Duration;
}

export const notificationPolicy = {
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
} as const satisfies Readonly<Record<NotificationType, NotificationPolicy>>;

export const notificationPageSize = 30;
