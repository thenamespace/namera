import { Schema } from "effect";

export class UnsupportedChainError extends Schema.TaggedError<UnsupportedChainError>()(
  "UnsupportedChainError",
  {
    namespace: Schema.String,
    chainId: Schema.String,
  },
  {
    description: "The requested blockchain is not supported",
    httpApiStatus: 400,
  },
) {}
