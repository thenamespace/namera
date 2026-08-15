import { Schema } from "effect";

import { SupportedEvmChainId } from "#/evm/chains";
import { Bytes32, EthereumAddress, Hex } from "#/evm/primitives";

const NonNegativeEvmQuantity = Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(0n));

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

export const EvmIntentSimulationCall = Schema.Struct({
  index: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  status: Schema.Literals(["success", "failure"]),
  gasUsed: NonNegativeEvmQuantity,
  data: Hex,
});

export const EvmIntentAssetChange = Schema.Struct({
  token: Schema.Struct({
    address: EthereumAddress,
    decimals: Schema.NullOr(Schema.Int),
    symbol: Schema.NullOr(Schema.String),
  }),
  value: Schema.Struct({
    before: NonNegativeEvmQuantity,
    after: NonNegativeEvmQuantity,
    difference: Schema.BigInt,
  }),
});

export const EvmIntentSimulation = Schema.Struct({
  calls: Schema.Array(EvmIntentSimulationCall),
  assetChanges: Schema.Array(EvmIntentAssetChange),
});

export const EvmIntentContext = Schema.Struct({
  version: Schema.Literal(1),
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  account: EthereumAddress,
  block: EvmIntentBlock,
  calls: Schema.Array(EvmIntentCall),
  userOperation: EvmIntentUserOperation,
  simulation: Schema.NullOr(EvmIntentSimulation),
}).annotate({
  identifier: "EvmIntentContext",
  description: "A normalized EVM execution intent evaluated by offchain policies",
});

export type EvmIntentCall = typeof EvmIntentCall.Type;
export type EvmIntentBlock = typeof EvmIntentBlock.Type;
export type EvmIntentGas = typeof EvmIntentGas.Type;
export type EvmIntentUserOperation = typeof EvmIntentUserOperation.Type;
export type EvmIntentSimulationCall = typeof EvmIntentSimulationCall.Type;
export type EvmIntentAssetChange = typeof EvmIntentAssetChange.Type;
export type EvmIntentSimulation = typeof EvmIntentSimulation.Type;
export type EvmIntentContext = typeof EvmIntentContext.Type;
