import { Schema } from "effect";

import { ActorId, OrganizationId, WalletOperationId, WalletId, SigningKeyId } from "#/common/index";
import {
  EvmPreparedExecution,
  EvmSignedExecution,
  SupportedEvmChainId,
  TransactionHash,
  Hex,
} from "#/evm/index";
import { NonEmptyString } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const WalletOperationKind = Schema.Literals(["set-primary-name", "transaction"]);
export const WalletOperationStatus = Schema.Literals([
  "awaiting-signature",
  "signed",
  "submitted",
  "confirmed",
  "failed",
  "expired",
  "cancelled",
]);

export const WalletOperationData = Schema.Struct({
  version: Schema.Literal(1),
  name: Schema.optionalKey(Schema.String),
  // The canonical JSON codec preserves decoded context timestamps across JSONB.
  prepared: Schema.toCodecJson(EvmPreparedExecution),
  signed: Schema.NullOr(EvmSignedExecution),
  broadcastAttempted: Schema.optionalKey(Schema.Boolean),
  submissionBlocked: Schema.optionalKey(Schema.Boolean),
  reconciliation: Schema.optionalKey(
    Schema.Struct({
      attempts: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      consecutiveErrors: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    }),
  ),
  owner: Schema.Struct({ signingKeyId: SigningKeyId, publicKey: Hex }),
});

export const WalletOperation = Schema.Struct({
  id: WalletOperationId,
  organizationId: OrganizationId,
  actorId: ActorId,
  walletId: WalletId,
  chainId: SupportedEvmChainId,
  kind: WalletOperationKind,
  idempotencyKey: NonEmptyString,
  requestHash: NonEmptyString,
  status: WalletOperationStatus,
  data: WalletOperationData,
  expiresAt: Schema.DateTimeUtcFromDate,
  leaseToken: Schema.NullOr(NonEmptyString),
  leaseExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  transactionHash: Schema.NullOr(TransactionHash),
  finishedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
});

export const WalletOperationInsert = createInsertSchema(
  WalletOperation,
  "organizationId",
  "actorId",
  "walletId",
  "chainId",
  "kind",
  "idempotencyKey",
  "requestHash",
  "data",
  "expiresAt",
);

export type WalletOperation = typeof WalletOperation.Type;
export type WalletOperationEncoded = typeof WalletOperation.Encoded;
export type WalletOperationInsert = typeof WalletOperationInsert.Type;
export type WalletOperationData = typeof WalletOperationData.Type;
