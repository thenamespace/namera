import { Schema } from "effect";

import { WalletOperationId } from "#/common/index";
import { TransactionHash } from "#/evm/index";
import { WalletOperationStatus } from "#/model/core/wallet-operation";

export const IdentityPrimaryOperation = Schema.Struct({
  operationId: WalletOperationId,
  name: Schema.String,
  status: WalletOperationStatus,
  transactionHash: Schema.NullOr(TransactionHash),
  sponsor: Schema.Boolean,
  retryKey: Schema.NullOr(Schema.String),
  submissionBlocked: Schema.optionalKey(Schema.Boolean),
});
export const IdentityPrimaryStatus = Schema.Struct({
  primaryName: Schema.NullOr(Schema.String),
  forwardAddress: Schema.NullOr(Schema.String),
  verified: Schema.Boolean,
  operation: Schema.NullOr(IdentityPrimaryOperation),
});
