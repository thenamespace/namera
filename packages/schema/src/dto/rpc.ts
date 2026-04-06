import { Schema } from "effect";

export class UnsupportedChain extends Schema.TaggedErrorClass<UnsupportedChain>()(
  "UnsupportedChain",
  {
    chainId: Schema.Number,
  },
) {}

export class RpcError extends Schema.TaggedErrorClass<RpcError>()("RpcError", {
  name: Schema.String,
  message: Schema.String,
  stack: Schema.optional(Schema.String),
}) {}
