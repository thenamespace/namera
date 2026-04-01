import { Schema } from "effect";

import { BigIntFromString, EthereumAddress, Hex } from "./common";

export const Call = Schema.Struct({
  to: EthereumAddress.annotate({
    description: "The target address to call",
  }),
  data: Hex.annotate({
    description: "The data to send with the call",
  }),
  value: Schema.optional(BigIntFromString).annotate({
    description: "The value to send with the call",
  }),
});

export const Batch = Schema.Struct({
  chainId: Schema.Int.annotate({
    description: "The chain ID to execute the transaction on",
  }),
  nonceKey: Schema.optional(Schema.String).annotate({
    description: "The nonce key to use, for 2D Parallel transactions.",
  }),
  calls: Schema.mutable(Schema.Array(Call)),
});

export const ExecuteTransactionParams = Schema.Struct({
  batches: Schema.mutable(Schema.Array(Batch)),
});

export type Call = typeof Call.Type;
export type Batch = typeof Batch.Type;
export type ExecuteTransactionParams = typeof ExecuteTransactionParams.Type;
