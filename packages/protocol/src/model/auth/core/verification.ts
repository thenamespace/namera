import { Schema, Struct } from "effect";

import { ApplicationRelativePath, Email, VerificationId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const VerificationPurpose = Schema.Literal("magic-link-signin");

export const VerificationData = Schema.Struct({
  returnTo: Schema.optionalKey(ApplicationRelativePath),
});

export const Verification = Schema.Struct({
  id: VerificationId,
  purpose: VerificationPurpose,
  identifier: Email,
  data: VerificationData,
  tokenHash: NonEmptyString,
  codeHmac: NonEmptyString,
  attempts: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  expiresAt: Schema.DateTimeUtcFromDate,
  consumedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const VerificationUpdate = createUpdateSchema(Verification);
export const VerificationInsert = createInsertSchema(
  Verification,
  "purpose",
  "identifier",
  "data",
  "tokenHash",
  "codeHmac",
  "expiresAt",
);

export type VerificationPurpose = typeof VerificationPurpose.Type;
export type VerificationData = typeof VerificationData.Type;
export type Verification = typeof Verification.Type;
export type VerificationUpdate = typeof VerificationUpdate.Type;
export type VerificationInsert = typeof VerificationInsert.Type;
