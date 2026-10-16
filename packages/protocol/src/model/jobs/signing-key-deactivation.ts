import { Schema, Struct } from "effect";

import { OrganizationId, SigningKeyId } from "#/common/index";
import { OneClawError } from "#/errors/one-claw";
import { ProviderConnectionError } from "#/errors/provider-connection";
import { TimestampFields } from "#/model/common";

export const SigningKeyDeactivationErrorCode = Schema.Union([
  OneClawError.fields.code,
  ProviderConnectionError.fields.code,
]);

export const SigningKeyDeactivation = Schema.Struct({
  id: Schema.NonEmptyString,
  organizationId: OrganizationId,
  signingKeyId: SigningKeyId,
  status: Schema.Literals(["pending", "completed", "needs-attention"]),
  attempts: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  availableAt: Schema.DateTimeUtcFromDate,
  leaseToken: Schema.NullOr(Schema.NonEmptyString),
  leaseExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastErrorCode: Schema.NullOr(SigningKeyDeactivationErrorCode),
  completedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export type SigningKeyDeactivation = typeof SigningKeyDeactivation.Type;
export type SigningKeyDeactivationErrorCode = typeof SigningKeyDeactivationErrorCode.Type;
