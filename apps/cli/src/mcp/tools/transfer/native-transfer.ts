import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { parseUnits } from "viem";

import { McpContext } from "@/layers/mcp-context";
import { Web3Service } from "@/layers/web3";
import { getSessionKeyClient, InsufficientPermissions } from "@/mcp/helpers";
import { EthereumAddress, getChain, SupportedChain } from "@/schema";

export const NativeTransferToolParams = Schema.Struct({
  chain: SupportedChain.annotate({
    description: "The chain to use for the transfer",
  }),
  address: EthereumAddress.annotate({
    description: "The ethereum address to transfer to",
  }),
  amount: Schema.String.annotate({
    description: "The amount of native tokens to transfer",
  }),
  unit: Schema.Literals(["wei", "gwei", "ether"]),
});

export type NativeTransferToolParams = typeof NativeTransferToolParams.Type;

export const NativeTransferTool = Tool.make("native_transfer", {
  dependencies: [McpContext, Web3Service],
  description: "Transfer Native Tokens to a specified address.",
  failure: InsufficientPermissions,
  parameters: NativeTransferToolParams,
  success: Schema.String.annotate({
    description: "The transaction hash of the transfer",
  }),
});

export const nativeTransferToolHandler = (params: NativeTransferToolParams) =>
  Effect.gen(function* () {
    const decimals = () => {
      if (params.unit === "wei") return 1;
      if (params.unit === "gwei") return 9;
      return 18;
    };

    const amount = parseUnits(params.amount.toString(), decimals());

    const client = yield* getSessionKeyClient({
      operation: {
        intent: "transaction",
        calls: [
          {
            target: params.address,
            value: amount,
            chainId: getChain(params.chain).id,
            data: "0x",
          },
        ],
      },
    });

    const tx = yield* Effect.promise(() =>
      client.sendTransaction({
        to: params.address,
        value: amount,
        data: "0x",
      }),
    );

    return tx;
  });
