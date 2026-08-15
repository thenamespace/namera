import { Duration, Schema } from "effect";

import type { EmailJobType } from "@namera-ai/protocol/model";

export const emailTemplates = {
  "magic-link": {
    id: "magic-link", // TODO: Update
    subject: "Sign in to Namera",
  },
  "new-sign-in": {
    id: "new-sign-in", // TODO: Update
    subject: "New sign-in to your Namera account",
  },
  "organization-invitation": {
    id: "organization-invitation", // TODO: Update
    subject: "You've been invited to join an organization on Namera",
  },
  "wallet-created": {
    id: "wallet-created", // TODO: Update
    subject: "Your Namera wallet is ready",
  },
  "session-key-created": {
    id: "session-key-created", // TODO: Update
    subject: "Your Namera session key is ready",
  },
  "api-key-created": {
    id: "api-key-created", // TODO: Update
    subject: "Your Namera API key is ready",
  },
  "execution-confirmed": {
    id: "execution-confirmed", // TODO: Update
    subject: "Transaction confirmed",
  },
} as const satisfies Record<EmailJobType, { readonly id: string; readonly subject: string }>;

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
