import { Effect, Schema } from "effect";
import { Tool, Toolkit } from "effect/unstable/ai";
import { type Address, parseEther } from "viem";

import { SessionKeyClient } from "@/layers";

import { EmptyArgs } from "./common";
import { NativeTransfer } from "./native-transfer";

const GetAddress = Tool.make("get_wallet_address", {
  dependencies: [SessionKeyClient],
  description: "Get the address of the wallet",
  failure: Schema.Never,
  parameters: EmptyArgs,
  success: Schema.String,
});

export const BaseTools = Toolkit.make(GetAddress, NativeTransfer);

export const BaseToolsHandlers = BaseTools.toLayer(
  Effect.gen(function* () {
    return {
      get_wallet_address: () =>
        Effect.gen(function* () {
          const client = yield* SessionKeyClient;
          return client.account.address;
        }),
      native_transfer: ({ address, amount }) =>
        Effect.gen(function* () {
          const client = yield* SessionKeyClient;

          const res = yield* Effect.promise(async () => {
            return await client.sendTransaction({
              to: address as Address,
              value: parseEther(amount),
            });
          });

          return res;
        }),
    };
  }),
);
