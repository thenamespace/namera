import { Duration, Schema } from "effect";

import type { EmailJobType } from "@namera-ai/protocol/model";

export const emailTemplates = {
  "magic-link": {
    id: "magic-link", // TODO: Update
  },
  "new-sign-in": {
    id: "new-sign-in", // TODO: Update
  },
  "organization-invitation": {
    id: "organization-invitation", // TODO: Update
  },
  "wallet-created": {
    id: "wallet-created", // TODO: Update
  },
} as const satisfies Record<EmailJobType, { readonly id: string }>;

export const emailPolicy = {
  requestTimeout: Duration.seconds(10),
  workerPollInterval: Duration.seconds(2),
  leaseDuration: Duration.seconds(30),
  maximumAttempts: 5,
  retryBaseDelay: Duration.seconds(5),
  retryMaximumDelay: Duration.minutes(5),
} as const;

export const emailRetryDelay = (attempt: number) =>
  Duration.millis(
    Math.min(
      Duration.toMillis(emailPolicy.retryBaseDelay) * 2 ** Math.max(0, attempt - 1),
      Duration.toMillis(emailPolicy.retryMaximumDelay),
    ),
  );

export const EmailProviderId = Schema.NonEmptyString.pipe(
  Schema.brand("@namera-ai/emails/EmailProviderId"),
);
export type EmailProviderId = typeof EmailProviderId.Type;
