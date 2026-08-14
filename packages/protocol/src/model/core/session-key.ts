import { Schema } from "effect";

import { ActorId, OrganizationId, SessionKeyId, WalletId } from "#/common/index";
import { MetadataDescription, MetadataLogo, MetadataName } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const SessionKeyStatus = Schema.Literals(["active", "revoked"]);

export const SessionKeyMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: MetadataName,
  logo: Schema.optionalKey(MetadataLogo),
  description: Schema.optionalKey(MetadataDescription),
});

// Session keys cannot carry policies until namespace-specific policy schemas are defined.
export const SessionKeyPolicy = Schema.Never;
export const SessionKeyPolicies = Schema.Array(SessionKeyPolicy);

export const SessionKey = Schema.Struct({
  id: SessionKeyId,
  organizationId: OrganizationId,
  walletId: WalletId,
  createdByActorId: ActorId,
  metadata: SessionKeyMetadata,
  policies: SessionKeyPolicies,
  policyHash: Schema.String,
  status: SessionKeyStatus,
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedByActorId: Schema.NullOr(ActorId),
  createdAt: Schema.DateTimeUtcFromDate,
});

export const SessionKeyInsert = createInsertSchema(
  SessionKey,
  "organizationId",
  "walletId",
  "createdByActorId",
  "metadata",
  "policies",
  "policyHash",
);

export type SessionKeyStatus = typeof SessionKeyStatus.Type;
export type SessionKeyMetadata = typeof SessionKeyMetadata.Type;
export type SessionKeyPolicy = typeof SessionKeyPolicy.Type;
export type SessionKeyPolicies = typeof SessionKeyPolicies.Type;
export type SessionKey = typeof SessionKey.Type;
export type SessionKeyInsert = typeof SessionKeyInsert.Type;
