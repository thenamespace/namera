import { Schema } from "effect";

import { EvmIntentContext } from "#/policy/evm/context";

import { SupportedEvmChainId } from "./chains.js";
import {
  Bytes32,
  EntryPointVersion,
  EthereumAddress,
  Hex,
  TransactionHash,
  UserOperationHash,
} from "./primitives.js";

const EvmQuantity = Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n));

const EvmSignedAuthorization = Schema.Struct({
  address: EthereumAddress,
  chainId: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  nonce: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  r: Hex,
  s: Hex,
  yParity: Schema.Literals([0, 1]),
});

export const EvmSerializedUserOperation = Schema.Struct({
  sender: EthereumAddress,
  nonce: EvmQuantity,
  factory: Schema.optionalKey(EthereumAddress),
  factoryData: Schema.optionalKey(Hex),
  callData: Hex,
  callGasLimit: EvmQuantity,
  verificationGasLimit: EvmQuantity,
  preVerificationGas: EvmQuantity,
  maxFeePerGas: EvmQuantity,
  maxPriorityFeePerGas: EvmQuantity,
  paymaster: Schema.optionalKey(EthereumAddress),
  paymasterVerificationGasLimit: Schema.optionalKey(EvmQuantity),
  paymasterPostOpGasLimit: Schema.optionalKey(EvmQuantity),
  paymasterData: Schema.optionalKey(Hex),
  signature: Hex,
  authorization: Schema.optionalKey(EvmSignedAuthorization),
}).annotate({
  identifier: "EvmSerializedUserOperation",
  description: "A JSON-safe ERC-4337 EntryPoint 0.7 UserOperation",
});

const EvmExecutionEnvelope = {
  version: Schema.Literal(1),
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  entryPointVersion: EntryPointVersion,
  entryPoint: EthereumAddress,
};

export const EvmPreparedExecution = Schema.Struct({
  ...EvmExecutionEnvelope,
  context: EvmIntentContext,
  userOperation: EvmSerializedUserOperation,
}).annotate({
  identifier: "EvmPreparedExecution",
  description: "A simulated EVM execution with a prepared stub-signed UserOperation",
});

export const EvmSignedExecution = Schema.Struct({
  ...EvmExecutionEnvelope,
  userOperation: EvmSerializedUserOperation,
  userOperationHash: UserOperationHash,
}).annotate({
  identifier: "EvmSignedExecution",
  description: "An EVM execution containing the exact signed UserOperation",
});

export const EvmSubmittedExecution = Schema.Struct({
  version: Schema.Literal(1),
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  userOperationHash: UserOperationHash,
}).annotate({
  identifier: "EvmSubmittedExecution",
  description: "An EVM UserOperation accepted or potentially accepted by a bundler",
});

const EvmExecutionReceiptCommon = {
  version: Schema.Literal(1),
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  userOperationHash: UserOperationHash,
  transactionHash: TransactionHash,
  blockHash: Bytes32,
  blockNumber: EvmQuantity,
  sender: EthereumAddress,
  nonce: EvmQuantity,
  entryPoint: EthereumAddress,
  paymaster: Schema.NullOr(EthereumAddress),
  actualGasCost: EvmQuantity,
  actualGasUsed: EvmQuantity,
};

export const SuccessfulEvmExecutionReceipt = Schema.Struct({
  ...EvmExecutionReceiptCommon,
  success: Schema.Literal(true),
  reason: Schema.Null,
}).annotate({ identifier: "SuccessfulEvmExecutionReceipt" });

export const FailedEvmExecutionReceipt = Schema.Struct({
  ...EvmExecutionReceiptCommon,
  success: Schema.Literal(false),
  reason: Schema.NullOr(Schema.String),
}).annotate({ identifier: "FailedEvmExecutionReceipt" });

export const EvmExecutionReceipt = Schema.Union([
  SuccessfulEvmExecutionReceipt,
  FailedEvmExecutionReceipt,
]).annotate({
  identifier: "EvmExecutionReceipt",
  description: "A normalized ERC-4337 UserOperation receipt",
});

export type EvmSerializedUserOperation = typeof EvmSerializedUserOperation.Type;
export type EvmPreparedExecution = typeof EvmPreparedExecution.Type;
export type EvmSignedExecution = typeof EvmSignedExecution.Type;
export type EvmSubmittedExecution = typeof EvmSubmittedExecution.Type;
export type SuccessfulEvmExecutionReceipt = typeof SuccessfulEvmExecutionReceipt.Type;
export type FailedEvmExecutionReceipt = typeof FailedEvmExecutionReceipt.Type;
export type EvmExecutionReceipt = typeof EvmExecutionReceipt.Type;
