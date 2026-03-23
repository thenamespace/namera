import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { formatUnits } from "viem";
import { getBalance } from "viem/actions";

import { McpContext } from "@/layers/mcp-context";
import { Web3Service } from "@/layers/web3";
import { getSessionKeyClient, InsufficientPermissions } from "@/mcp/helpers";
import { EthereumAddress, getChain, SupportedChain } from "@/schema";

export const GetBalanceToolParams = Schema.Struct({
  address: EthereumAddress.annotate({
    description: "The address to get the balance for",
  }),
  chain: SupportedChain.annotate({
    description: "The chain to get the balance for",
  }),
});

export const GetBalanceToolResult = Schema.Struct({
  nativeCurrency: Schema.Struct({
    name: Schema.String.annotate({
      description: "The name of the currency",
    }),
    symbol: Schema.String.annotate({
      description: "The symbol of the currency",
    }),
    decimals: Schema.Number.annotate({
      description: "The number of decimals the currency has",
    }),
  }).annotate({
    description: "The native currency of the chain",
  }),
  balance: Schema.Struct({
    amount: Schema.String.annotate({
      description: "Balance in atomic units",
    }),
    formatted: Schema.String.annotate({
      description: "Balance in native currency units",
    }),
  }),
});

export type GetBalanceToolResult = typeof GetBalanceToolResult.Type;
export type GetBalanceToolParams = typeof GetBalanceToolParams.Type;

export const GetBalanceTool = Tool.make("get_balance", {
  dependencies: [McpContext, Web3Service],
  description: "Get the address of the wallet",
  failure: InsufficientPermissions,
  parameters: GetBalanceToolParams,
  success: GetBalanceToolResult,
});

export const getBalanceToolHandler = (params: GetBalanceToolParams) =>
  Effect.gen(function* () {
    const sessionKeyClient = yield* getSessionKeyClient({
      operation: {
        intent: "read",
        chainId: getChain(params.chain).id,
      },
    });

    const res = yield* Effect.promise(() =>
      getBalance(sessionKeyClient.client, {
        address: params.address,
      }),
    );

    const data = {
      nativeCurrency: sessionKeyClient.chain.nativeCurrency,
      balance: {
        amount: res.toString(),
        formatted: formatUnits(
          res,
          sessionKeyClient.chain.nativeCurrency.decimals,
        ),
      },
    };

    return data;
  });
