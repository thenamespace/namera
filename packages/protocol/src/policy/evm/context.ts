import { Schema } from "effect";

import { SupportedEvmChainId } from "#/evm/chains";
import {
  EVM_MAX_AGGREGATE_CALL_DATA_BYTES,
  EVM_MAX_AGGREGATE_RETURN_DATA_BYTES,
  EVM_MAX_CALL_DATA_BYTES,
  EVM_MAX_CALLS,
  EVM_MAX_RETURN_DATA_BYTES,
  evmHexByteLength,
} from "#/evm/limits";
import { Bytes32, EthereumAddress, Hex } from "#/evm/primitives";

const NonNegativeEvmQuantity = Schema.BigIntFromString.check(
  Schema.isGreaterThanOrEqualToBigInt(0n),
);
const EvmQuantity = Schema.BigIntFromString;

export const EvmIntentCall = Schema.Struct({
  to: EthereumAddress,
  value: NonNegativeEvmQuantity,
  data: Hex.check(
    Schema.makeFilter((data) =>
      evmHexByteLength(data) <= EVM_MAX_CALL_DATA_BYTES
        ? undefined
        : { path: [], issue: "Call data may not exceed 32 KiB" },
    ),
  ),
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
    returnData: Hex.check(
      Schema.makeFilter((data) =>
        evmHexByteLength(data) <= EVM_MAX_RETURN_DATA_BYTES
          ? undefined
          : { path: [], issue: "Return data may not exceed 32 KiB" },
      ),
    ),
    gasUsed: NonNegativeEvmQuantity,
  }),
  Schema.Struct({
    status: Schema.Literal("failure"),
    returnData: Hex.check(
      Schema.makeFilter((data) =>
        evmHexByteLength(data) <= EVM_MAX_RETURN_DATA_BYTES
          ? undefined
          : { path: [], issue: "Return data may not exceed 32 KiB" },
      ),
    ),
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
  results: Schema.Array(EvmSimulatedCallResult).check(
    Schema.isMaxLength(EVM_MAX_CALLS, { message: "At most 32 call results are allowed" }),
    Schema.makeFilter((results) =>
      results.reduce((total, result) => total + evmHexByteLength(result.returnData), 0) <=
      EVM_MAX_AGGREGATE_RETURN_DATA_BYTES
        ? undefined
        : { path: [], issue: "Aggregate return data may not exceed 128 KiB" },
    ),
  ),
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
  calls: Schema.Array(EvmIntentCall).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(EVM_MAX_CALLS),
    Schema.makeFilter((calls) =>
      calls.reduce((total, call) => total + evmHexByteLength(call.data), 0) <=
      EVM_MAX_AGGREGATE_CALL_DATA_BYTES
        ? undefined
        : { path: [], issue: "Aggregate call data may not exceed 128 KiB" },
    ),
  ),
  userOperation: EvmIntentUserOperation,
  simulation: EvmIntentSimulation,
})
  .check(
    Schema.makeFilter((context) =>
      context.simulation.calls.results.length === context.calls.length
        ? undefined
        : {
            path: ["simulation", "calls", "results"],
            issue: "Simulation results must match the number of calls",
          },
    ),
  )
  .annotate({
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
