import { Schema } from "effect";

import {
  ActorId,
  OrganizationId,
  SessionKeyInstallationId,
  SessionKeyOperationId,
  WalletId,
  SigningKeyId,
} from "#/common/index";
import {
  EvmPreparedExecution,
  EvmSignedExecution,
  SupportedEvmChainId,
  TransactionHash,
  Hex,
} from "#/evm/index";
import { NonEmptyString } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const SessionKeyOperationKind = Schema.Literals(["install", "uninstall"]);
export const SessionKeyOperationStatus = Schema.Literals([
  "awaiting-signature",
  "signed",
  "submitted",
  "confirmed",
  "failed",
  "expired",
]);

export const SessionKeyOperationData = Schema.Struct({
  version: Schema.Literal(1),
  // The canonical JSON codec preserves decoded context timestamps across JSONB.
  prepared: Schema.toCodecJson(EvmPreparedExecution),
  signed: Schema.NullOr(EvmSignedExecution),
  managedOwner: Schema.optional(Schema.Struct({ signingKeyId: SigningKeyId, publicKey: Hex })),
});

export const SessionKeyOperation = Schema.Struct({
  id: SessionKeyOperationId,
  organizationId: OrganizationId,
  actorId: ActorId,
  installationId: SessionKeyInstallationId,
  walletId: WalletId,
  chainId: SupportedEvmChainId,
  kind: SessionKeyOperationKind,
  idempotencyKey: NonEmptyString,
  requestHash: NonEmptyString,
  status: SessionKeyOperationStatus,
  data: SessionKeyOperationData,
  expiresAt: Schema.DateTimeUtcFromDate,
  leaseToken: Schema.NullOr(NonEmptyString),
  leaseExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  transactionHash: Schema.NullOr(TransactionHash),
  finishedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
});

export const SessionKeyOperationInsert = createInsertSchema(
  SessionKeyOperation,
  "organizationId",
  "actorId",
  "installationId",
  "walletId",
  "chainId",
  "kind",
  "idempotencyKey",
  "requestHash",
  "data",
  "expiresAt",
);

export type SessionKeyOperation = typeof SessionKeyOperation.Type;
export type SessionKeyOperationEncoded = typeof SessionKeyOperation.Encoded;
export type SessionKeyOperationInsert = typeof SessionKeyOperationInsert.Type;
export type SessionKeyOperationData = typeof SessionKeyOperationData.Type;
