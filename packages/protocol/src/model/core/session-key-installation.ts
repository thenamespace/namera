import { Schema } from "effect";

import { OrganizationId, SessionKeyId, SessionKeyInstallationId, WalletId } from "#/common/index";
import {
  Bytes32,
  EthereumAddress,
  EvmSessionAuthorization,
  EvmSessionEntityId,
  Hex,
  SupportedEvmChainId,
  TransactionHash,
  UserOperationHash,
} from "#/evm/index";
import { createInsertSchema } from "#/model/helpers";

export const SessionKeyInstallationStatus = Schema.Literals([
  "pending",
  "submitted",
  "installed",
  "revoking",
  "revoked",
  "failed",
]);

/** Immutable compiler output. Public-key data only; never a signer or private key. */
export const EvmSessionInstallationData = Schema.Struct({
  version: Schema.Literal(1),
  authorization: EvmSessionAuthorization,
  moduleAddress: EthereumAddress,
  isGlobal: Schema.Boolean,
  installCallData: Hex,
  uninstallCallData: Hex,
  hooks: Schema.Array(Schema.Struct({ moduleAddress: EthereumAddress, entityId: Schema.Int })),
});

export const SessionKeyInstallation = Schema.Struct({
  id: SessionKeyInstallationId,
  organizationId: OrganizationId,
  sessionKeyId: SessionKeyId,
  walletId: WalletId,
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  entityId: EvmSessionEntityId,
  configurationHash: Bytes32,
  data: EvmSessionInstallationData,
  status: SessionKeyInstallationStatus,
  installUserOperationHash: Schema.NullOr(UserOperationHash),
  installTransactionHash: Schema.NullOr(TransactionHash),
  uninstallUserOperationHash: Schema.NullOr(UserOperationHash),
  uninstallTransactionHash: Schema.NullOr(TransactionHash),
  installedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
});

export const SessionKeyInstallationInsert = createInsertSchema(
  SessionKeyInstallation,
  "organizationId",
  "sessionKeyId",
  "walletId",
  "namespace",
  "chainId",
  "entityId",
  "configurationHash",
  "data",
);

export type SessionKeyInstallation = typeof SessionKeyInstallation.Type;
export type SessionKeyInstallationEncoded = typeof SessionKeyInstallation.Encoded;
export type SessionKeyInstallationInsert = typeof SessionKeyInstallationInsert.Type;
export type EvmSessionInstallationData = typeof EvmSessionInstallationData.Type;
export type SessionKeyInstallationStatus = typeof SessionKeyInstallationStatus.Type;
