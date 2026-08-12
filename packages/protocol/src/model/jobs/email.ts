import { Schema, Struct } from "effect";

import { EmailJobId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createUpdateSchema } from "#/model/helpers";

export const EmailJobStatus = Schema.Literals([
  "pending",
  "processing",
  "sent",
  "failed",
  "expired",
]);

export const EmailJob = Schema.Struct({
  id: EmailJobId,
  type: NonEmptyString,
  idempotencyKey: NonEmptyString,
  encryptedPayload: Schema.NullOr(NonEmptyString),
  status: EmailJobStatus,
  attempts: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  availableAt: Schema.DateTimeUtcFromDate,
  expiresAt: Schema.DateTimeUtcFromDate,
  leaseToken: Schema.NullOr(NonEmptyString),
  leaseExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  providerMessageId: Schema.NullOr(NonEmptyString),
  sentAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastErrorCode: Schema.NullOr(NonEmptyString),
}).mapFields(Struct.assign(TimestampFields));

export const EmailJobInsert = Schema.Struct({
  type: NonEmptyString,
  idempotencyKey: NonEmptyString,
  encryptedPayload: NonEmptyString,
  availableAt: Schema.optionalKey(Schema.DateTimeUtcFromDate),
  expiresAt: Schema.DateTimeUtcFromDate,
});
export const EmailJobUpdate = createUpdateSchema(EmailJob);

export type EmailJobStatus = typeof EmailJobStatus.Type;
export type EmailJob = typeof EmailJob.Type;
export type EmailJobInsert = typeof EmailJobInsert.Type;
export type EmailJobUpdate = typeof EmailJobUpdate.Type;
