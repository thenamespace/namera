import { Schema, Struct } from "effect";

import { EmailJobId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createUpdateSchema } from "#/model/helpers";

import { EmailJobType } from "./email-payload.js";

export const EmailJobStatus = Schema.Literals([
  "pending",
  "processing",
  "sent",
  "failed",
  "expired",
]);

export const EmailJobErrorCode = Schema.Literals([
  "DECRYPT_FAILED",
  "INVALID_PAYLOAD",
  "REQUEST_FAILED",
  "PROVIDER_REJECTED",
  "INVALID_RESPONSE",
]);

export const EmailJob = Schema.Struct({
  id: EmailJobId,
  type: EmailJobType,
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
  lastErrorCode: Schema.NullOr(EmailJobErrorCode),
}).mapFields(Struct.assign(TimestampFields));

export const EmailJobInsert = Schema.Struct({
  type: EmailJobType,
  idempotencyKey: NonEmptyString,
  encryptedPayload: NonEmptyString,
  availableAt: Schema.optionalKey(Schema.DateTimeUtcFromDate),
  expiresAt: Schema.DateTimeUtcFromDate,
});
export const EmailJobUpdate = createUpdateSchema(EmailJob);

export type EmailJobStatus = typeof EmailJobStatus.Type;
export type EmailJobErrorCode = typeof EmailJobErrorCode.Type;
export type EmailJob = typeof EmailJob.Type;
export type EmailJobInsert = typeof EmailJobInsert.Type;
export type EmailJobUpdate = typeof EmailJobUpdate.Type;
