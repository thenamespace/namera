import { Schema } from "effect";

import { SupportedEvmChainId } from "#/evm/chains";
import { Bytes32, EthereumAddress, Hex } from "#/evm/primitives";

const NonNegativeEvmQuantity = Schema.BigIntFromString.check(
  Schema.isGreaterThanOrEqualToBigInt(0n),
);
const EvmQuantity = Schema.BigIntFromString;

export const EvmIntentCall = Schema.Struct({
  to: EthereumAddress,
  value: NonNegativeEvmQuantity,
  data: Hex,
});

export const EvmIntentBlock = Schema.Struct({
  number: NonNegativeEvmQuantity,
  hash: Bytes32,
  timestamp: Schema.DateTimeUtcFromDate,
});

export const EvmIntentGas = Schema.Struct({
  callGasLimit: NonNegativeEvmQuantity,
  verificationGasLimit: NonNegativeEvmQuantity,
  preVerificationGas: NonNegativeEvmQuantity,
  paymasterVerificationGasLimit: NonNegativeEvmQuantity,
  paymasterPostOpGasLimit: NonNegativeEvmQuantity,
  maxFeePerGas: NonNegativeEvmQuantity,
  maxPriorityFeePerGas: NonNegativeEvmQuantity,
});

export const EvmIntentUserOperation = Schema.Struct({
  nonce: NonNegativeEvmQuantity,
  gas: EvmIntentGas,
  paymaster: Schema.NullOr(EthereumAddress),
});

export const EvmUserOperationSimulation = Schema.Struct({
  source: Schema.Literal("eth_estimateUserOperationGas"),
  callGasLimit: NonNegativeEvmQuantity,
  verificationGasLimit: NonNegativeEvmQuantity,
  preVerificationGas: NonNegativeEvmQuantity,
  paymasterVerificationGasLimit: NonNegativeEvmQuantity,
  paymasterPostOpGasLimit: NonNegativeEvmQuantity,
});

export const EvmSimulatedCallResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("success"),
    returnData: Hex,
    gasUsed: NonNegativeEvmQuantity,
  }),
  Schema.Struct({
    status: Schema.Literal("failure"),
    returnData: Hex,
    gasUsed: NonNegativeEvmQuantity,
  }),
]);

export const EvmSimulatedAsset = Schema.Struct({
  address: EthereumAddress,
  symbol: Schema.NullOr(Schema.String.check(Schema.isMaxLength(64))),
  decimals: Schema.NullOr(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(255)),
  ),
});

export const EvmSimulatedAssetChange = Schema.Struct({
  asset: EvmSimulatedAsset,
  pre: NonNegativeEvmQuantity,
  post: NonNegativeEvmQuantity,
  diff: EvmQuantity,
});

export const EvmSimulatedNativeTransfer = Schema.Struct({
  callIndex: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  from: EthereumAddress,
  to: EthereumAddress,
  value: NonNegativeEvmQuantity,
});

export const EvmCallSimulation = Schema.Struct({
  source: Schema.Literal("viem.simulateCalls"),
  results: Schema.Array(EvmSimulatedCallResult),
  assetChanges: Schema.Array(EvmSimulatedAssetChange).check(Schema.isMaxLength(256)),
  transfers: Schema.Array(EvmSimulatedNativeTransfer).check(Schema.isMaxLength(256)),
});

export const EvmIntentSimulation = Schema.Struct({
  userOperation: EvmUserOperationSimulation,
  calls: EvmCallSimulation,
});

export const EvmIntentContext = Schema.Struct({
  version: Schema.Literal(1),
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  account: EthereumAddress,
  block: EvmIntentBlock,
  calls: Schema.Array(EvmIntentCall),
  userOperation: EvmIntentUserOperation,
  simulation: EvmIntentSimulation,
}).annotate({
  identifier: "EvmIntentContext",
  description: "A normalized EVM execution intent evaluated by offchain policies",
});

export type EvmIntentCall = typeof EvmIntentCall.Type;
export type EvmIntentBlock = typeof EvmIntentBlock.Type;
export type EvmIntentGas = typeof EvmIntentGas.Type;
export type EvmIntentUserOperation = typeof EvmIntentUserOperation.Type;
export type EvmUserOperationSimulation = typeof EvmUserOperationSimulation.Type;
export type EvmSimulatedCallResult = typeof EvmSimulatedCallResult.Type;
export type EvmSimulatedAsset = typeof EvmSimulatedAsset.Type;
export type EvmSimulatedAssetChange = typeof EvmSimulatedAssetChange.Type;
export type EvmSimulatedNativeTransfer = typeof EvmSimulatedNativeTransfer.Type;
export type EvmCallSimulation = typeof EvmCallSimulation.Type;
export type EvmIntentSimulation = typeof EvmIntentSimulation.Type;
export type EvmIntentContext = typeof EvmIntentContext.Type;
