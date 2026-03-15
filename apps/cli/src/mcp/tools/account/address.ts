import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";

import { CurrentMcpContext } from "@/layers";

import { EmptyArgs } from "../common";

export const GetAddressTool = Tool.make("get_wallet_address", {
  dependencies: [CurrentMcpContext],
  description: "Get the address of the wallet",
  failure: Schema.Never,
  parameters: EmptyArgs,
  success: Schema.String,
});

export const getAddressToolHandler = () =>
  Effect.gen(function* () {
    const context = yield* CurrentMcpContext;

    return context.account.data.smartAccountAddress;
  });

// export const BaseToolsHandlers = BaseTools.toLayer(
//   Effect.gen(function* () {
//     return {
//       get_wallet_address: () =>
//         Effect.gen(function* () {
//           const client = yield* SessionKeyClient;
//           return client.account.address;
//         }),
//       native_transfer: ({ address, amount }) =>
//         Effect.gen(function* () {
//           const client = yield* SessionKeyClient;

//           const res = yield* Effect.promise(async () => {
//             return await client.sendTransaction({
//               to: address as Address,
//               value: parseEther(amount),
//             });
//           });

//           return res;
//         }),
//     };
//   }),
// );
