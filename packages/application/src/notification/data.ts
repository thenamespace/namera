import { Duration } from "effect";

import type { NotificationType } from "@namera-ai/protocol/model";

interface NotificationPolicy {
  readonly category: "security" | "organization";
  readonly inApp: "always" | "configurable";
  readonly email: "always" | "configurable";
  readonly emailTimeToLive: Duration.Duration;
}

export const notificationPolicy: Readonly<Record<NotificationType, NotificationPolicy>> = {
  "auth.new-sign-in": {
    category: "security",
    inApp: "always",
    email: "configurable",
    emailTimeToLive: Duration.days(1),
  },
  "organization.invitation.received": {
    category: "organization",
    inApp: "always",
    email: "configurable",
    emailTimeToLive: Duration.days(7),
  },
};

export const notificationPageSize = 30;
