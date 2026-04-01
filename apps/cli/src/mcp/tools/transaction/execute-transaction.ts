import { executeTransaction } from "@namera-ai/sdk/transaction";
import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";

import { McpContext } from "@/layers/mcp-context";
import { Web3Service } from "@/layers/web3";
import { getSessionKeyClient, InsufficientPermissions } from "@/mcp/helpers";
import type { Hex } from "@/schema";
import { Batch } from "@/schema/tx";

export const ExecuteTransactionToolParams = Batch;

export type ExecuteTransactionToolParams =
  typeof ExecuteTransactionToolParams.Type;

export const NativeTransferTool = Tool.make("execute_transaction", {
  dependencies: [McpContext, Web3Service],
  description: "Send transactions.",
  failure: InsufficientPermissions,
  parameters: ExecuteTransactionToolParams,
  success: Schema.String.annotate({
    description: "The transaction hash for the executed transaction.",
  }),
});

export const executeTransactionToolHandler = (
  params: ExecuteTransactionToolParams,
) =>
  Effect.gen(function* () {
    const batches: Batch[] = [
      {
        chainId: params.chainId,
        nonceKey: params.nonceKey,
        calls: params.calls,
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
