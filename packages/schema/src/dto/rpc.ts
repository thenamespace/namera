import { Schema } from "effect";

export class UnsupportedChain extends Schema.TaggedError<UnsupportedChain>()(
  "UnsupportedChain",
  {
    chainId: Schema.Number,
  },
) {}

export class RpcError extends Schema.TaggedError<RpcError>()("RpcError", {
  name: Schema.String,
  message: Schema.String,
  stack: Schema.optional(Schema.String),
}) {}
