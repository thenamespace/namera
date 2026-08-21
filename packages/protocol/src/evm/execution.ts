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

export const EvmExecutionSponsorship = Schema.Literals(["none", "alchemy-bso"]).annotate({
  identifier: "EvmExecutionSponsorship",
  description: "Whether an execution is self-funded or sponsored by Alchemy's bundler",
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
  sponsorship: EvmExecutionSponsorship,
};

export const EvmGasPriceQuote = Schema.Struct({
  provider: Schema.Literal("alchemy"),
  currency: Schema.Literal("usd"),
  nativeAsset: Schema.Literal("ETH"),
  nativePriceMicroUsd: EvmQuantity,
  surchargeBasisPoints: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  // The encoded form remains an ISO string inside JSON persistence while the
  // decoded domain value is a validated UTC timestamp.
  quotedAt: Schema.DateTimeUtcFromString,
}).annotate({ identifier: "EvmGasPriceQuote" });

export const EvmExecutionBilling = Schema.Struct({
  executionMeter: Schema.Literals(["execution.mainnet", "execution.testnet"]),
  sponsorship: Schema.NullOr(
    Schema.Struct({
      provider: Schema.Literal("alchemy"),
      mode: Schema.Literal("bso"),
      reservationAmountMicroUsd: EvmQuantity,
      quote: EvmGasPriceQuote,
    }),
  ),
}).annotate({ identifier: "EvmExecutionBilling" });

export const EvmPreparedExecution = Schema.Struct({
  ...EvmExecutionEnvelope,
  context: EvmIntentContext,
  userOperation: EvmSerializedUserOperation,
  billing: EvmExecutionBilling,
}).annotate({
  identifier: "EvmPreparedExecution",
  description: "A simulated EVM execution with a prepared stub-signed UserOperation",
});

export const EvmSignedExecution = Schema.Struct({
  ...EvmExecutionEnvelope,
  userOperation: EvmSerializedUserOperation,
  userOperationHash: UserOperationHash,
  billing: EvmExecutionBilling,
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

export const EvmUserOperationStatus = Schema.Struct({
  status: Schema.Literals([
    "not_found",
    "not_submitted",
    "submitted",
    "rejected",
    "reverted",
    "included",
    "failed",
  ]),
  transactionHash: Schema.NullOr(TransactionHash),
}).annotate({
  identifier: "EvmUserOperationStatus",
  description: "The normalized Alchemy Rundler lifecycle status for an EVM UserOperation",
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
export type EvmExecutionSponsorship = typeof EvmExecutionSponsorship.Type;
export type EvmGasPriceQuote = typeof EvmGasPriceQuote.Type;
export type EvmExecutionBilling = typeof EvmExecutionBilling.Type;
export type EvmPreparedExecution = typeof EvmPreparedExecution.Type;
export type EvmSignedExecution = typeof EvmSignedExecution.Type;
export type EvmSubmittedExecution = typeof EvmSubmittedExecution.Type;
export type EvmUserOperationStatus = typeof EvmUserOperationStatus.Type;
export type SuccessfulEvmExecutionReceipt = typeof SuccessfulEvmExecutionReceipt.Type;
export type FailedEvmExecutionReceipt = typeof FailedEvmExecutionReceipt.Type;
export type EvmExecutionReceipt = typeof EvmExecutionReceipt.Type;
