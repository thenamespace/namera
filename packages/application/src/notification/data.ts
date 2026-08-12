import { Duration } from "effect";

import type { NotificationType } from "@namera-ai/protocol/model";

export const notificationPolicy = {
  "auth.new-sign-in": {
    category: "security",
    inApp: "always",
    email: "configurable",
    emailTimeToLive: Duration.days(1),
  },
  "organization.invitation.received": {
    category: "organization",
    inApp: "always",
    email: "always",
    emailTimeToLive: Duration.days(7),
  },
} as const satisfies Record<
  NotificationType,
  {
    readonly category: "security" | "organization";
    readonly inApp: "always" | "configurable";
    readonly email: "always" | "configurable";
    readonly emailTimeToLive: Duration.Duration;
  }
>;

export const notificationPageSize = 30;
