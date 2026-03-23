import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";

import { McpContext } from "@/layers/mcp-context";
import { EmptyArgs } from "@/mcp/helpers/common";

export const GetAddressTool = Tool.make("get_wallet_address", {
  dependencies: [McpContext],
  description: "Get the address of the wallet",
  failure: Schema.Never,
  parameters: EmptyArgs,
  success: Schema.String,
});

export const getAddressToolHandler = () =>
  Effect.gen(function* () {
    const context = yield* McpContext;

    return context.smartAccount.smartAccountAddress;
  });
