import { Schema, Struct } from "effect";

import { ActorId, OrganizationId, SessionKeyId, SigningKeyId, WalletId } from "#/common/index";
import { MetadataDescription, MetadataLogo, MetadataName } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";
import {
  CreateEvmContractAccessPolicy,
  EvmContractAccessPolicy,
  CreateEvmContractFunctionsPolicy,
  EvmContractFunctionsPolicy,
  CreateEvmWildcardFunctionsPolicy,
  EvmWildcardFunctionsPolicy,
  CreateEvmAccountFunctionsPolicy,
  EvmAccountFunctionsPolicy,
  CreateEvmTokenSpendPolicy,
  EvmTokenSpendPolicy,
  CreateEvmChainAllowlistPolicy,
  CreateEvmGasBudgetPolicy,
  CreateEvmNativeSpendLimitPolicy,
  CreateEvmSignaturePolicy,
  CreateEvmTimeWindowPolicy,
  EvmChainAllowlistPolicy,
  EvmGasBudgetPolicy,
  EvmNativeSpendLimitPolicy,
  EvmSignaturePolicy,
  EvmTimeWindowPolicy,
} from "#/policy/evm/index";

export const SessionKeyStatus = Schema.Literals(["pending", "active", "revoking", "revoked"]);

export const SessionKeyMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: MetadataName,
  logo: Schema.optionalKey(MetadataLogo),
  description: Schema.optionalKey(MetadataDescription),
});

export const EvmSessionKeyPolicy = Schema.Union([
  EvmContractAccessPolicy,
  EvmContractFunctionsPolicy,
  EvmWildcardFunctionsPolicy,
  EvmAccountFunctionsPolicy,
  EvmTokenSpendPolicy,
  EvmTimeWindowPolicy,
  EvmChainAllowlistPolicy,
  EvmGasBudgetPolicy,
  EvmNativeSpendLimitPolicy,
  EvmSignaturePolicy,
]);
export const CreateEvmSessionKeyPolicy = Schema.Union([
  CreateEvmContractAccessPolicy,
  CreateEvmContractFunctionsPolicy,
  CreateEvmWildcardFunctionsPolicy,
  CreateEvmAccountFunctionsPolicy,
  CreateEvmTokenSpendPolicy,
  CreateEvmTimeWindowPolicy,
  CreateEvmChainAllowlistPolicy,
  CreateEvmGasBudgetPolicy,
  CreateEvmNativeSpendLimitPolicy,
  CreateEvmSignaturePolicy,
]);
export const EvmSessionKeyPolicies = Schema.Array(EvmSessionKeyPolicy);
export const EvmSessionPolicyType = Schema.Literals(
  CreateEvmSessionKeyPolicy.members.map((policy) => policy.fields.type.literal),
);

export const SessionKeyPolicy = EvmSessionKeyPolicy;
export const SessionKeyPolicies = EvmSessionKeyPolicies;

const SessionKeyCommon = Schema.Struct({
  id: SessionKeyId,
  organizationId: OrganizationId,
  walletId: WalletId,
  signingKeyId: SigningKeyId,
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
  "signingKeyId",
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
