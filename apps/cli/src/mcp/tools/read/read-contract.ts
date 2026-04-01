import { Effect, Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import { readContract } from "viem/actions";

import { McpContext } from "@/layers/mcp-context";
import { Web3Service } from "@/layers/web3";
import { getSessionKeyClient, InsufficientPermissions } from "@/mcp/helpers";
import { EthereumAddress, getChain, SupportedChain } from "@/schema";

export const ReadContractToolParams = Schema.Struct({
  chain: SupportedChain.annotate({
    description: "The chain to use for the transfer",
  }),
  contractAddress: EthereumAddress.annotate({
    description: "The ethereum address of the contract to read",
  }),
  abi: Schema.Array(Schema.Any).annotate({
    description: "The ABI of the contract to read",
  }),
  functionName: Schema.String.annotate({
    description: "The name of the function to call on the contract",
  }),
  args: Schema.Array(Schema.Any).annotate({
    description: "The arguments to pass to the function",
  }),
});

export type ReadContractToolParams = typeof ReadContractToolParams.Type;

export const ReadContractTool = Tool.make("read_contract", {
  dependencies: [McpContext, Web3Service],
  description: "Read data from a specified contract.",
  failure: InsufficientPermissions,
  parameters: ReadContractToolParams,
  success: Schema.Any.annotate({
    description: "The data returned by the contract",
  }),
});

export const readContractToolHandler = (params: ReadContractToolParams) =>
  Effect.gen(function* () {
    const chain = getChain(params.chain);

    const client = yield* getSessionKeyClient({
      operation: {
        intent: "read",
        chainId: chain.id,
      },
    });

    readContract(client, {
      address: params.contractAddress,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    });

    const result = yield* Effect.promise(() =>
      readContract(client, {
        address: params.contractAddress,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
      }),
    );

    return result;
  });
