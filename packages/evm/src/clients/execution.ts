import { Redacted } from "effect";

import { estimateFeesPerGas, type RundlerRpcSchema } from "@alchemy/aa-infra";
import { alchemyTransport } from "@alchemy/common";
import { createClient, createPublicClient, type PublicClient } from "viem";
import {
  createBundlerClient,
  type BundlerClient,
  type BundlerClientConfig,
  type SmartAccount,
} from "viem/account-abstraction";

import { arcMinimumFeePerGas } from "../chains/arc.js";
import type { ChainData } from "../chains/data.js";
import type { EvmConfigValues } from "../config.js";

type UserOperationStatusRpcSchema = {
  Method: "eth_getUserOperationByHash";
  Parameters: [`0x${string}`];
  ReturnType: unknown;
};

type AlchemyBundlerRpcSchema = [...RundlerRpcSchema, UserOperationStatusRpcSchema];

export type ExecutionClients = {
  readonly publicClient: PublicClient;
  readonly bundlerClient: BundlerClient;
  readonly statusClient: {
    readonly request: (parameters: {
      readonly method: "eth_getUserOperationByHash";
      readonly params: [`0x${string}`];
    }) => Promise<unknown>;
  };
  readonly createSmartAccountClient: (account: SmartAccount) => BundlerClient;
  readonly getSubmissionClient: (sponsorship: "none" | "alchemy-bso") => BundlerClient;
};

const createExecutionClients = (config: EvmConfigValues, chain: ChainData): ExecutionClients => {
  const apiKey = Redacted.value(config.alchemyApiKey);
  const rpcUrl = `https://${chain.alchemyChain}.g.alchemy.com/v2`;
  const transport = alchemyTransport<AlchemyBundlerRpcSchema>({
    apiKey,
    url: rpcUrl,
  });
  const sponsoredTransport = alchemyTransport<AlchemyBundlerRpcSchema>({
    apiKey,
    fetchOptions: {
      headers: {
        "x-alchemy-policy-id": Redacted.value(config.alchemyBsoPolicyId),
      },
    },
    url: rpcUrl,
  });
  const publicClient = createPublicClient({ chain: chain.chain, transport });
  const statusClient = createClient<
    typeof transport,
    typeof chain.chain,
    undefined,
    AlchemyBundlerRpcSchema
  >({ chain: chain.chain, transport });
  const userOperation: NonNullable<BundlerClientConfig["userOperation"]> = {
    estimateFeesPerGas: async ({ account, bundlerClient: feeClient, userOperation: operation }) => {
      const fees = await estimateFeesPerGas({
        bundlerClient: feeClient,
        ...(account === undefined ? {} : { account }),
        ...(operation === undefined ? {} : { userOperation: operation }),
      });

      return {
        ...fees,
        maxFeePerGas:
          chain.name === "arc" && fees.maxFeePerGas < arcMinimumFeePerGas
            ? arcMinimumFeePerGas
            : fees.maxFeePerGas,
      };
    },
  };
  const bundlerClient = createBundlerClient({
    chain: chain.chain,
    client: publicClient,
    transport,
    userOperation,
  });
  const sponsoredBundlerClient = createBundlerClient({
    chain: chain.chain,
    client: publicClient,
    transport: sponsoredTransport,
    userOperation,
  });

  return {
    publicClient,
    bundlerClient,
    statusClient,
    getSubmissionClient: (sponsorship) =>
      sponsorship === "alchemy-bso" ? sponsoredBundlerClient : bundlerClient,
    createSmartAccountClient: (account: SmartAccount) =>
      createBundlerClient({
        account,
        chain: chain.chain,
        client: publicClient,
        transport,
        userOperation,
      }),
  };
};

export const makeExecutionClients = (
  config: EvmConfigValues,
): ((chain: ChainData) => ExecutionClients) => {
  const clients = new Map<number, ExecutionClients>();

  return (chain: ChainData) => {
    const cached = clients.get(chain.chain.id);
    if (cached !== undefined) return cached;

    const created = createExecutionClients(config, chain);
    clients.set(chain.chain.id, created);
    return created;
  };
};
