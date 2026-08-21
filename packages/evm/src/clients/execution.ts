import { Redacted } from "effect";

import { estimateFeesPerGas, type RundlerRpcSchema } from "@alchemy/aa-infra";
import { alchemyTransport } from "@alchemy/common";
import { createClient, createPublicClient, type PublicClient } from "viem";
import {
  createBundlerClient,
  createPaymasterClient,
  type BundlerClient,
  type SmartAccount,
} from "viem/account-abstraction";

import type { ChainData } from "../chains/data.js";
import type { EvmConfigValues } from "../config.js";

type UserOperationStatusRpcSchema = {
  Method: "rundler_getUserOperationStatus";
  Parameters: [`0x${string}`];
  ReturnType: unknown;
};

type AlchemyBundlerRpcSchema = [...RundlerRpcSchema, UserOperationStatusRpcSchema];

export type ExecutionClients = {
  readonly publicClient: PublicClient;
  readonly bundlerClient: BundlerClient;
  readonly statusClient: {
    readonly request: (parameters: {
      readonly method: "rundler_getUserOperationStatus";
      readonly params: [`0x${string}`];
    }) => Promise<unknown>;
  };
  readonly createSmartAccountClient: (
    account: SmartAccount,
    sponsorship: "none" | "sponsored",
  ) => BundlerClient;
};

const createExecutionClients = (config: EvmConfigValues, chain: ChainData): ExecutionClients => {
  const apiKey = Redacted.value(config.alchemyApiKey);
  const transport = alchemyTransport<AlchemyBundlerRpcSchema>({ apiKey });
  const publicClient = createPublicClient({ chain: chain.chain, transport });
  const statusClient = createClient<
    typeof transport,
    typeof chain.chain,
    undefined,
    AlchemyBundlerRpcSchema
  >({ chain: chain.chain, transport });
  const paymasterClient = createPaymasterClient({ transport });
  const bundlerClient = createBundlerClient({
    chain: chain.chain,
    client: publicClient,
    transport,
    userOperation: {
      estimateFeesPerGas: ({
        account: feeAccount,
        bundlerClient: feeBundlerClient,
        userOperation,
      }) =>
        estimateFeesPerGas({
          bundlerClient: feeBundlerClient,
          ...(feeAccount === undefined ? {} : { account: feeAccount }),
          ...(userOperation === undefined ? {} : { userOperation }),
        }),
    },
  });

  return {
    publicClient,
    bundlerClient,
    statusClient,
    createSmartAccountClient: (account: SmartAccount, sponsorship: "none" | "sponsored") =>
      createBundlerClient({
        account,
        chain: chain.chain,
        client: publicClient,
        transport,
        ...(sponsorship === "sponsored"
          ? {
              paymaster: paymasterClient,
              paymasterContext: {
                policyId: Redacted.value(config.alchemyGasPolicyId),
              },
            }
          : {}),
        userOperation: {
          estimateFeesPerGas: ({
            account: feeAccount,
            bundlerClient: feeBundlerClient,
            userOperation,
          }) =>
            estimateFeesPerGas({
              bundlerClient: feeBundlerClient,
              ...(feeAccount === undefined ? {} : { account: feeAccount }),
              ...(userOperation === undefined ? {} : { userOperation }),
            }),
        },
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
