import { Schema } from "effect";

import { WalletOperationId } from "#/common/index";
import { EvmPreparedExecution, TransactionHash } from "#/evm/index";
import { WalletOperationStatus } from "#/model/core/wallet-operation";

import { PasskeyAuthenticationOptions, PasskeyAuthenticationResponse } from "./wallet/passkey.js";

export const PrepareIdentityPrimaryRequest = Schema.Struct({
  idempotencyKey: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
});
export const PrepareIdentityPrimaryResponse = Schema.Struct({
  operationId: WalletOperationId,
  approval: Schema.Literals(["passkey", "1claw"]),
  options: Schema.NullOr(PasskeyAuthenticationOptions),
  prepared: EvmPreparedExecution,
  expiresAt: Schema.DateTimeUtcFromDate,
});
export const ApproveIdentityPrimaryRequest = Schema.Struct({
  operationId: WalletOperationId,
  response: Schema.optional(PasskeyAuthenticationResponse),
});
export const IdentityPrimaryOperation = Schema.Struct({
  operationId: WalletOperationId,
  name: Schema.String,
  status: WalletOperationStatus,
  transactionHash: Schema.NullOr(TransactionHash),
  retryKey: Schema.NullOr(Schema.String),
});
export const IdentityPrimaryStatus = Schema.Struct({
  primaryName: Schema.NullOr(Schema.String),
  forwardAddress: Schema.NullOr(Schema.String),
  verified: Schema.Boolean,
  operation: Schema.NullOr(IdentityPrimaryOperation),
});
export type PrepareIdentityPrimaryRequest = typeof PrepareIdentityPrimaryRequest.Type;
export type ApproveIdentityPrimaryRequest = typeof ApproveIdentityPrimaryRequest.Type;
export type PrepareIdentityPrimaryResponse = typeof PrepareIdentityPrimaryResponse.Type;
