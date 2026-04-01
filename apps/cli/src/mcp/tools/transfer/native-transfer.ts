import { executeTransaction } from "@namera-ai/sdk/transaction";
import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { parseUnits } from "viem";

import { McpContext } from "@/layers/mcp-context";
import { Web3Service } from "@/layers/web3";
import { getSessionKeyClient, InsufficientPermissions } from "@/mcp/helpers";
import { EthereumAddress, getChain, type Hex, SupportedChain } from "@/schema";
import type { Batch } from "@/schema/tx";

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
    const chain = getChain(params.chain);

    const batches: Batch[] = [
      {
        chainId: chain.id,
        calls: [
          {
            to: params.address,
            value: amount,
            data: "0x",
          },
        ],
      },
    ];

    const client = yield* getSessionKeyClient({
      operation: {
        intent: "transaction",
        batches,
      },
    });

    const txHashes = yield* Effect.promise(() =>
      executeTransaction({
        clients: [client],
        batches,
      }),
    );

    return txHashes[0]?.receipt.transactionHash as Hex;
  });
