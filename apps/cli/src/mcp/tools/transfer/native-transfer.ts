import { createSessionKeyClient } from "@namera-ai/core";
import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { type Address, createPublicClient, http, parseUnits } from "viem";
import { sepolia } from "viem/chains";

import { CurrentMcpContext } from "@/layers";
import { InsufficientPermissions } from "@/mcp/common";
import { pickSessionKey } from "@/mcp/helpers";

export const NativeTransferToolParams = Schema.Struct({
  address: Schema.String.annotate({
    description: "The ethereum address to transfer to.",
  }),
  amount: Schema.String.annotate({
    description: "The amount of native tokens to transfer",
  }),
  unit: Schema.Literals(["wei", "gwei", "ether"]).annotate({
    description: "The unit of the amount to transfer",
  }),
});
export type NativeTransferToolParams = typeof NativeTransferToolParams.Type;

export const NativeTransferTool = Tool.make("native_transfer", {
  dependencies: [CurrentMcpContext],
  description: "Transfer Native Tokens to a specified address.",
  failure: InsufficientPermissions,
  parameters: NativeTransferToolParams,
  success: Schema.String.annotate({
    description: "The transaction hash of the transfer.",
  }),
});

export const nativeTransferHandler = (params: NativeTransferToolParams) =>
  Effect.gen(function* () {
    const decimals = (() => {
      if (params.unit === "wei") return 1;
      if (params.unit === "gwei") return 9;
      return 18;
    })();

    const value = parseUnits(params.amount, decimals);

    const sessionKey = yield* pickSessionKey({
      operation: {
        data: {
          data: "0x",
          target: params.address as Address,
          value,
        },
        intent: "transaction",
      },
    });

    if (sessionKey === undefined) return yield* new InsufficientPermissions();

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });

    const client = yield* Effect.promise(() =>
      createSessionKeyClient({
        bundlerTransport: http(),
        chain: sepolia,
        client: publicClient,
        serializedAccount: sessionKey.serializedAccount,
        sessionKeySigner: sessionKey.signer,
      }),
    );

    const tx = yield* Effect.promise(() =>
      client.sendTransaction({
        to: params.address as Address,
        value,
      }),
    );

    return tx;
  });
