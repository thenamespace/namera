import { Schema } from "effect";

import { OrganizationId, SessionKeyId, WalletId } from "#/common/index";
import { EvmSessionKeyPolicies, SessionKeyMetadata, SessionKeyStatus } from "#/model/index";
import { CreateEvmTimeWindowPolicy } from "#/policy/index";

import { GetOrganizationMemberResponse } from "../auth/organization/member.js";
import { WalletResponse } from "../wallet/index.js";

export const CreateEvmSessionKeyRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  walletId: WalletId,
  metadata: SessionKeyMetadata,
  policies: Schema.Array(Schema.Union([CreateEvmTimeWindowPolicy])).check(
    Schema.isMinLength(1, { message: "At least one policy is required" }),
  ),
}).annotate({
  identifier: "CreateEvmSessionKeyRequest",
  description: "Create an EVM session key with immutable offchain policies",
});

export const CreateSessionKeyRequest = Schema.Union([CreateEvmSessionKeyRequest], {
  mode: "oneOf",
}).annotate({ identifier: "CreateSessionKeyRequest" });

const EvmSessionKeyResponseFields = {
  id: SessionKeyId,
  organizationId: OrganizationId,
  walletId: WalletId,
  namespace: Schema.Literal("eip155"),
  metadata: SessionKeyMetadata,
  policies: EvmSessionKeyPolicies,
  policyHash: Schema.String,
  status: SessionKeyStatus,
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  createdAt: Schema.DateTimeUtcFromDate,
};

export const EvmSessionKeySummaryResponse = Schema.Struct(EvmSessionKeyResponseFields).annotate({
  identifier: "EvmSessionKeySummaryResponse",
  description: "An EVM session key without expanded related resources",
});

export const SessionKeySummaryResponse = Schema.Union([EvmSessionKeySummaryResponse], {
  mode: "oneOf",
}).annotate({ identifier: "SessionKeySummaryResponse" });

export const EvmSessionKeyResponse = Schema.Struct({
  ...EvmSessionKeyResponseFields,
  wallet: WalletResponse,
  creator: GetOrganizationMemberResponse,
}).annotate({
  identifier: "EvmSessionKeyResponse",
  description: "An EVM session key with its wallet and creating organization member",
});

export const SessionKeyResponse = Schema.Union([EvmSessionKeyResponse], {
  mode: "oneOf",
}).annotate({ identifier: "SessionKeyResponse" });

export const CreateSessionKeyResponse = SessionKeyResponse.annotate({
  identifier: "CreateSessionKeyResponse",
});

export const GetSessionKeyRequest = Schema.Struct({
  sessionKeyId: SessionKeyId,
}).annotate({ identifier: "GetSessionKeyRequest" });

export const GetSessionKeyResponse = SessionKeyResponse.annotate({
  identifier: "GetSessionKeyResponse",
});

export const ListSessionKeysForWalletRequest = Schema.Struct({
  walletId: WalletId,
}).annotate({ identifier: "ListSessionKeysForWalletRequest" });

export const ListSessionKeysForWalletResponse = Schema.Array(SessionKeyResponse).annotate({
  identifier: "ListSessionKeysForWalletResponse",
});

export const ListSessionKeysForOrganizationResponse = Schema.Array(SessionKeyResponse).annotate({
  identifier: "ListSessionKeysForOrganizationResponse",
});

export type CreateEvmSessionKeyRequest = typeof CreateEvmSessionKeyRequest.Type;
export type CreateSessionKeyRequest = typeof CreateSessionKeyRequest.Type;
export type EvmSessionKeySummaryResponse = typeof EvmSessionKeySummaryResponse.Type;
export type SessionKeySummaryResponse = typeof SessionKeySummaryResponse.Type;
export type EvmSessionKeyResponse = typeof EvmSessionKeyResponse.Type;
export type SessionKeyResponse = typeof SessionKeyResponse.Type;
export type CreateSessionKeyResponse = typeof CreateSessionKeyResponse.Type;
export type GetSessionKeyRequest = typeof GetSessionKeyRequest.Type;
export type GetSessionKeyResponse = typeof GetSessionKeyResponse.Type;
export type ListSessionKeysForWalletRequest = typeof ListSessionKeysForWalletRequest.Type;
export type ListSessionKeysForWalletResponse = typeof ListSessionKeysForWalletResponse.Type;
export type ListSessionKeysForOrganizationResponse =
  typeof ListSessionKeysForOrganizationResponse.Type;
