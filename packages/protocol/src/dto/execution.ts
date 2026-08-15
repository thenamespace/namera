import { Schema } from "effect";

import { ExecutionId, ExecutionSubmissionId, WalletId } from "#/common/index";
import {
  EthereumAddress,
  Hex,
  SuccessfulEvmExecutionReceipt,
  SupportedEvmChainId,
  UserOperationHash,
} from "#/evm/index";
import { NonEmptyString } from "#/model/common";

const EvmExecutionCallRequest = Schema.Struct({
  to: EthereumAddress,
  value: Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n)),
  data: Hex,
});

export const ExecuteEvmRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  walletId: WalletId,
  chainId: SupportedEvmChainId,
  calls: Schema.Array(EvmExecutionCallRequest).check(
    Schema.isMinLength(1, { message: "At least one call is required" }),
  ),
}).annotate({
  identifier: "ExecuteEvmRequest",
  description: "Execute EVM calls through an API key's authorized session keys",
});

export const ExecuteRequest = Schema.Union([ExecuteEvmRequest], { mode: "oneOf" }).annotate({
  identifier: "ExecuteRequest",
});

export const ExecuteRequestHeaders = Schema.Struct({
  "idempotency-key": NonEmptyString,
}).annotate({ identifier: "ExecuteRequestHeaders" });

export const SubmittedEvmExecutionResponse = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  status: Schema.Literal("submitted"),
  submissionId: ExecutionSubmissionId,
  userOperationHash: UserOperationHash,
}).annotate({ identifier: "SubmittedEvmExecutionResponse" });

export const ConfirmedEvmExecutionResponse = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  status: Schema.Literal("confirmed"),
  submissionId: ExecutionSubmissionId,
  executionId: ExecutionId,
  receipt: SuccessfulEvmExecutionReceipt,
}).annotate({ identifier: "ConfirmedEvmExecutionResponse" });

export const ExecuteResponse = Schema.Union(
  [SubmittedEvmExecutionResponse, ConfirmedEvmExecutionResponse],
  { mode: "oneOf" },
).annotate({ identifier: "ExecuteResponse" });

export type ExecuteEvmRequest = typeof ExecuteEvmRequest.Type;
export type ExecuteRequest = typeof ExecuteRequest.Type;
export type ExecuteRequestHeaders = typeof ExecuteRequestHeaders.Type;
export type SubmittedEvmExecutionResponse = typeof SubmittedEvmExecutionResponse.Type;
export type ConfirmedEvmExecutionResponse = typeof ConfirmedEvmExecutionResponse.Type;
export type ExecuteResponse = typeof ExecuteResponse.Type;
