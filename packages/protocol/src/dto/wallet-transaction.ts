import { Schema } from "effect";

import { WalletId, WalletOperationId } from "#/common/index";
import { TransactionHash } from "#/evm/index";
import { WalletOperationStatus } from "#/model/core/wallet-operation";

import {
  PrepareEvmExecutionResponse,
  CompleteEvmExecutionRequest,
  CompleteExecutionResponse,
} from "./execution-signing.js";
import { ExecuteEvmRequest } from "./execution.js";
import { EvmNativePriceQuote } from "./gas-price.js";
import { PasskeyAuthenticationOptions, PasskeyAuthenticationResponse } from "./wallet/passkey.js";

export const WalletTransactionParams = Schema.Struct({ walletId: WalletId });
export const GetWalletTransactionRequest = Schema.Struct({
  walletId: WalletId,
  operationId: WalletOperationId,
});
export const PrepareWalletEvmTransactionRequest = Schema.Struct({
  namespace: ExecuteEvmRequest.fields.namespace,
  chainId: ExecuteEvmRequest.fields.chainId,
  calls: ExecuteEvmRequest.fields.calls,
  sponsor: ExecuteEvmRequest.fields.sponsor,
}).annotate({ identifier: "PrepareWalletEvmTransactionRequest" });
export const PrepareWalletTransactionRequest = Schema.Union([PrepareWalletEvmTransactionRequest], {
  mode: "oneOf",
}).annotate({ identifier: "PrepareWalletTransactionRequest" });
export const PrepareWalletEvmTransactionResponse = Schema.Struct({
  namespace: PrepareEvmExecutionResponse.fields.namespace,
  operationId: WalletOperationId,
  signingKeyId: PrepareEvmExecutionResponse.fields.signingKeyId,
  prepared: PrepareEvmExecutionResponse.fields.prepared,
  signing: Schema.Union([
    Schema.Struct({ method: Schema.Literal("passkey"), options: PasskeyAuthenticationOptions }),
    Schema.Struct({ method: Schema.Literal("server") }),
  ]),
  expiresAt: PrepareEvmExecutionResponse.fields.expiresAt,
  priceQuote: Schema.NullOr(EvmNativePriceQuote),
}).annotate({ identifier: "PrepareWalletEvmTransactionResponse" });
export const PrepareWalletTransactionResponse = Schema.Union(
  [PrepareWalletEvmTransactionResponse],
  { mode: "oneOf" },
).annotate({ identifier: "PrepareWalletTransactionResponse" });
export const CompleteWalletEvmTransactionRequest = Schema.Struct({
  namespace: CompleteEvmExecutionRequest.fields.namespace,
  operationId: WalletOperationId,
  response: Schema.optionalKey(PasskeyAuthenticationResponse),
}).annotate({ identifier: "CompleteWalletEvmTransactionRequest" });
export const CompleteWalletTransactionRequest = Schema.Union(
  [CompleteWalletEvmTransactionRequest],
  { mode: "oneOf" },
).annotate({ identifier: "CompleteWalletTransactionRequest" });
export const CompleteWalletEvmTransactionResponse = Schema.Struct({
  namespace: CompleteExecutionResponse.fields.namespace,
  operationId: WalletOperationId,
  status: Schema.Literals(["signed", "submitted", "confirmed", "failed"]),
  userOperationHash: CompleteExecutionResponse.fields.userOperationHash,
}).annotate({ identifier: "CompleteWalletEvmTransactionResponse" });
export const CompleteWalletTransactionResponse = Schema.Union(
  [CompleteWalletEvmTransactionResponse],
  { mode: "oneOf" },
).annotate({ identifier: "CompleteWalletTransactionResponse" });
export const GetWalletEvmTransactionResponse = Schema.Struct({
  namespace: CompleteExecutionResponse.fields.namespace,
  operationId: WalletOperationId,
  status: WalletOperationStatus,
  userOperationHash: Schema.NullOr(CompleteExecutionResponse.fields.userOperationHash),
  transactionHash: Schema.NullOr(TransactionHash),
  submissionBlocked: Schema.Boolean,
}).annotate({ identifier: "GetWalletEvmTransactionResponse" });
export const GetWalletTransactionResponse = Schema.Union([GetWalletEvmTransactionResponse], {
  mode: "oneOf",
}).annotate({ identifier: "GetWalletTransactionResponse" });

export type PrepareWalletTransactionRequest = typeof PrepareWalletTransactionRequest.Type;
export type PrepareWalletTransactionResponse = typeof PrepareWalletTransactionResponse.Type;
export type CompleteWalletTransactionRequest = typeof CompleteWalletTransactionRequest.Type;
export type CompleteWalletTransactionResponse = typeof CompleteWalletTransactionResponse.Type;
export type GetWalletTransactionResponse = typeof GetWalletTransactionResponse.Type;
