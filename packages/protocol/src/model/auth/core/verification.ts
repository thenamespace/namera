import { Schema } from "effect";

import {
  ApplicationRelativePath,
  Email,
  OrganizationId,
  UserId,
  VerificationId,
} from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const VerificationPurpose = Schema.Literals(["magic-link-signin", "passkey-registration"]);

export const MagicLinkVerificationData = Schema.Struct({
  returnTo: Schema.optionalKey(ApplicationRelativePath),
});

export const PasskeyRegistrationVerificationData = Schema.Struct({
  version: Schema.Literal(1),
  challenge: NonEmptyString,
  rpId: NonEmptyString,
  origin: NonEmptyString,
  organizationId: OrganizationId,
  userId: UserId,
});

export const VerificationData = Schema.Union([
  MagicLinkVerificationData,
  PasskeyRegistrationVerificationData,
]);

const VerificationLifecycleFields = {
  id: VerificationId,
  attempts: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  expiresAt: Schema.DateTimeUtcFromDate,
  consumedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  ...TimestampFields,
};

export const MagicLinkVerification = Schema.Struct({
  ...VerificationLifecycleFields,
  purpose: Schema.Literal("magic-link-signin"),
  identifier: Email,
  data: MagicLinkVerificationData,
  tokenHash: NonEmptyString,
  codeHmac: NonEmptyString,
});

export const PasskeyRegistrationVerification = Schema.Struct({
  ...VerificationLifecycleFields,
  purpose: Schema.Literal("passkey-registration"),
  identifier: NonEmptyString,
  data: PasskeyRegistrationVerificationData,
  tokenHash: Schema.Null,
  codeHmac: Schema.Null,
});

export const Verification = Schema.Union([MagicLinkVerification, PasskeyRegistrationVerification]);

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
export type MagicLinkVerification = typeof MagicLinkVerification.Type;
export type PasskeyRegistrationVerification = typeof PasskeyRegistrationVerification.Type;
export type Verification = typeof Verification.Type;
export type VerificationUpdate = typeof VerificationUpdate.Type;
export type VerificationInsert = typeof VerificationInsert.Type;
