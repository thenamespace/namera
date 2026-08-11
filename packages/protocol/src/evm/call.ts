import { Schema } from "effect";

import { EthereumAddress, Hex } from "#/common/web3";
import { EvmValue } from "#/evm/primitives";

export const EvmCall = Schema.Struct({
  to: EthereumAddress,
  value: Schema.optional(EvmValue),
  data: Schema.optional(Hex),
}).annotate({
  identifier: "EvmCall",
  description: "A call executed by an EVM smart account",
});

export const EvmCalls = Schema.Array(EvmCall).annotate({
  identifier: "EvmCalls",
  description: "An ordered list of EVM smart-account calls",
});

export type EvmCall = typeof EvmCall.Type;
export type EvmCalls = typeof EvmCalls.Type;
