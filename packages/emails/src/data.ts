import { Duration, Schema } from "effect";

import type { EmailJobType } from "@namera-ai/protocol/model";

export const emailTemplates = {
  "platform-invitation": { subject: "You're invited to the Namera admin team" },
  "connected-account-changed": {
    subject: "Your connected Google account changed",
  },
  "magic-link": {
    subject: "Sign in to Namera",
  },
  "new-sign-in": {
    subject: "New sign-in to your Namera account",
  },
  "organization-invitation": {
    subject: "You've been invited to join an organization on Namera",
  },
  "wallet-created": {
    subject: "Your Namera wallet is ready",
  },
  "session-key-created": {
    subject: "Your Namera session key is ready",
  },
  "session-key-revoked": {
    subject: "Session key revoked",
  },
  "api-key-created": {
    subject: "Your Namera API key is ready",
  },
  "api-key-revoked": {
    subject: "API key revoked",
  },
} as const satisfies Record<EmailJobType, { readonly subject: string }>;

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
