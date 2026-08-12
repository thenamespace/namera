import type { DateTime } from "effect";

import type { EmailJobPayload } from "@namera-ai/protocol/model";

export type SendEmailProps = EmailJobPayload & {
  readonly idempotencyKey?: string;
};

export type EnqueueEmailProps = EmailJobPayload & {
  readonly idempotencyKey: string;
  readonly availableAt?: DateTime.Utc;
  readonly expiresAt: DateTime.Utc;
};
