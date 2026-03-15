import { Schema } from "effect";
import { Tool } from "effect/unstable/ai";

import { SessionKeyClient } from "@/layers";

export const NativeTransfer = Tool.make("native_transfer", {
  dependencies: [SessionKeyClient],
  description: "Transfer Native Tokens to a specified address.",
  failure: Schema.Never,
  parameters: Schema.Struct({
    address: Schema.String.annotate({
      description: "The ethereum address to transfer to.",
    }),
    amount: Schema.String.annotate({
      description: "The amount of native tokens to transfer, in (eth units",
    }),
  }),
  success: Schema.String.annotate({
    description: "The transaction hash of the transfer.",
  }),
});
