import { Schema, Struct } from "effect";

import { ActorId, OrganizationId, SessionKeyId, WalletId } from "#/common/index";
import { MetadataDescription, MetadataLogo, MetadataName } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";
import {
  CreateEvmChainAllowlistPolicy,
  CreateEvmNativeSpendLimitPolicy,
  CreateEvmSignaturePolicy,
  CreateEvmTimeWindowPolicy,
  EvmChainAllowlistPolicy,
  EvmNativeSpendLimitPolicy,
  EvmSignaturePolicy,
  EvmTimeWindowPolicy,
} from "#/policy/evm/index";

export const SessionKeyStatus = Schema.Literals(["active", "revoked"]);

export const SessionKeyMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: MetadataName,
  logo: Schema.optionalKey(MetadataLogo),
  description: Schema.optionalKey(MetadataDescription),
});

export const EvmSessionKeyPolicy = Schema.Union([
  EvmTimeWindowPolicy,
  EvmChainAllowlistPolicy,
  EvmNativeSpendLimitPolicy,
  EvmSignaturePolicy,
]);
export const CreateEvmSessionKeyPolicy = Schema.Union([
  CreateEvmTimeWindowPolicy,
  CreateEvmChainAllowlistPolicy,
  CreateEvmNativeSpendLimitPolicy,
  CreateEvmSignaturePolicy,
]);
export const EvmSessionKeyPolicies = Schema.Array(EvmSessionKeyPolicy).check(
  Schema.isMinLength(1, { message: "At least one policy is required" }),
);

export const SessionKeyPolicy = EvmSessionKeyPolicy;
export const SessionKeyPolicies = EvmSessionKeyPolicies;

const SessionKeyCommon = Schema.Struct({
  id: SessionKeyId,
  organizationId: OrganizationId,
  walletId: WalletId,
  createdByActorId: ActorId,
  metadata: SessionKeyMetadata,
  policyHash: Schema.String,
  status: SessionKeyStatus,
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedByActorId: Schema.NullOr(ActorId),
  createdAt: Schema.DateTimeUtcFromDate,
});

export const EvmSessionKey = SessionKeyCommon.mapFields(
  Struct.assign({
    namespace: Schema.Literal("eip155"),
    policies: EvmSessionKeyPolicies,
  }),
);

export const SessionKey = Schema.Union([EvmSessionKey]);

export const SessionKeyInsert = createInsertSchema(
  SessionKey,
  "organizationId",
  "walletId",
  "createdByActorId",
  "namespace",
  "metadata",
  "policies",
  "policyHash",
);

export type SessionKeyStatus = typeof SessionKeyStatus.Type;
export type SessionKeyMetadata = typeof SessionKeyMetadata.Type;
export type EvmSessionKeyPolicy = typeof EvmSessionKeyPolicy.Type;
export type CreateEvmSessionKeyPolicy = typeof CreateEvmSessionKeyPolicy.Type;
export type EvmSessionKeyPolicies = typeof EvmSessionKeyPolicies.Type;
export type SessionKeyPolicy = typeof SessionKeyPolicy.Type;
export type SessionKeyPolicies = typeof SessionKeyPolicies.Type;
export type EvmSessionKey = typeof EvmSessionKey.Type;
export type SessionKey = typeof SessionKey.Type;
export type SessionKeyEncoded = typeof SessionKey.Encoded;
export type SessionKeyInsert = typeof SessionKeyInsert.Type;
