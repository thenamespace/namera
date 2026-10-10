import { Schema } from "effect";

export * from "./operation.js";
export * from "./signer.js";

import {
  OrganizationId,
  SessionKeyId,
  SessionKeyInstallationId,
  SigningKeyId,
  WalletId,
} from "#/common/index";
import {
  EvmSessionAuthorization,
  EvmSessionPermissions,
  SupportedEvmChainId,
  TransactionHash,
} from "#/evm/index";
import {
  CreateEvmSessionKeyPolicy,
  EvmSessionKeyPolicies,
  SessionKeyMetadata,
  SessionKeyStatus,
  SessionKeyInstallationStatus,
} from "#/model/index";

import { GetOrganizationMemberResponse } from "../auth/organization/member.js";
import { WalletResponse } from "../wallet/index.js";
import { EvmSessionSignerRequest, EvmSessionSignerResponse } from "./signer.js";

export const CreateEvmSessionKeyRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  walletId: WalletId,
  metadata: SessionKeyMetadata,
  signer: EvmSessionSignerRequest,
  onchain: Schema.Struct({
    chains: Schema.Array(SupportedEvmChainId)
      .check(Schema.isMinLength(1))
      .check(
        Schema.makeFilter((chains) =>
          new Set(chains).size === chains.length ? undefined : "Duplicate chain",
        ),
      ),
    validAfter: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    validUntil: Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(1),
      // Expiry is also stored as a timestamp and used for notifications.
      Schema.isLessThanOrEqualTo(8_640_000_000_000),
    ),
    permissions: EvmSessionPermissions,
    allowSignatures: EvmSessionAuthorization.fields.allowSignatures,
  }).check(
    Schema.makeFilter((value) =>
      value.validUntil > value.validAfter
        ? undefined
        : { path: ["validUntil"], issue: "Session expiry must follow its start time" },
    ),
  ),
  policies: Schema.Array(CreateEvmSessionKeyPolicy),
}).annotate({
  identifier: "CreateEvmSessionKeyRequest",
  description:
    "Register a local or 1Claw-managed secp256k1 session with mandatory onchain permissions and optional API policies. The key remains pending until its owner-approved installation is confirmed. Managed execution and signing are not yet available. Never send private key material.",
});

export const CreateSessionKeyRequest = Schema.Union([CreateEvmSessionKeyRequest], {
  mode: "oneOf",
}).annotate({ identifier: "CreateSessionKeyRequest" });

const EvmSessionKeyResponseFields = {
  id: SessionKeyId,
  organizationId: OrganizationId,
  walletId: WalletId,
  signingKeyId: SigningKeyId,
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

export const SessionKeyInstallationResponse = Schema.Struct({
  id: SessionKeyInstallationId,
  chainId: SupportedEvmChainId,
  status: SessionKeyInstallationStatus,
  authorization: EvmSessionAuthorization,
  installTransactionHash: Schema.NullOr(TransactionHash),
  uninstallTransactionHash: Schema.NullOr(TransactionHash),
}).annotate({
  identifier: "SessionKeyInstallationResponse",
  description:
    "Public onchain authorization and its confirmed installation state. Pending entries are not usable.",
});

export const EvmSessionKeyResponse = Schema.Struct({
  ...EvmSessionKeyResponseFields,
  signer: EvmSessionSignerResponse,
  wallet: WalletResponse,
  creator: GetOrganizationMemberResponse,
  installations: Schema.Array(SessionKeyInstallationResponse),
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

export const RevokeSessionKeyRequest = Schema.Struct({
  sessionKeyId: SessionKeyId,
}).annotate({ identifier: "RevokeSessionKeyRequest" });

export const RevokeSessionKeyResponse = SessionKeyResponse.annotate({
  identifier: "RevokeSessionKeyResponse",
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
export type RevokeSessionKeyRequest = typeof RevokeSessionKeyRequest.Type;
export type RevokeSessionKeyResponse = typeof RevokeSessionKeyResponse.Type;
export type ListSessionKeysForWalletRequest = typeof ListSessionKeysForWalletRequest.Type;
export type ListSessionKeysForWalletResponse = typeof ListSessionKeysForWalletResponse.Type;
export type ListSessionKeysForOrganizationResponse =
  typeof ListSessionKeysForOrganizationResponse.Type;
