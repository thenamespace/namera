import { Schema, Struct } from "effect";

import {
  ActorId,
  CredentialId,
  OrganizationId,
  SignerProvisioningId,
  SigningKeyId,
} from "#/common/index";
import { TimestampFields } from "#/model/common";

import { SigningKeyInsert, SigningKeyPurpose } from "./signing-key.js";

export const SignerProvisioningStatus = Schema.Literals([
  "pending",
  "remote_started",
  "ready",
  "recovery_required",
  "completed",
]);

export const SignerProvisioning = Schema.Struct({
  id: SignerProvisioningId,
  organizationId: OrganizationId,
  actorId: ActorId,
  provider: Schema.NonEmptyString,
  purpose: SigningKeyPurpose,
  idempotencyKey: Schema.NonEmptyString,
  requestHash: Schema.NonEmptyString,
  signingKeyId: SigningKeyId,
  credentialId: CredentialId,
  status: SignerProvisioningStatus,
  stage: Schema.NonEmptyString,
  signer: Schema.NullOr(SigningKeyInsert),
  resourceId: Schema.NullOr(Schema.NonEmptyString),
  leaseToken: Schema.NullOr(Schema.String),
  leaseExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export type SignerProvisioning = typeof SignerProvisioning.Type;
export type SignerProvisioningEncoded = typeof SignerProvisioning.Encoded;

export const ProvisioningIdempotencyKey = Schema.NonEmptyString.check(
  Schema.isMaxLength(128),
).annotate({
  description:
    "Reuse for retries of the same managed creation. Use a new key for a distinct resource. Without a key, identical managed requests are deduplicated.",
});
