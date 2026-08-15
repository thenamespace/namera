import { Redacted } from "effect";

import { createPublicClient, http } from "viem";
import type { PublicClient } from "viem";
import { createBundlerClient, createPaymasterClient } from "viem/account-abstraction";
import type { BundlerClient, PaymasterClient } from "viem/account-abstraction";

import type { ChainData } from "../chains/data.js";
import type { EvmConfigValues } from "../config.js";

export type ExecutionClients = {
  readonly publicClient: PublicClient;
  readonly bundlerClient: BundlerClient;
  readonly paymasterClient: PaymasterClient;
};

export const makeExecutionClients = (
  config: EvmConfigValues,
): ((chain: ChainData) => ExecutionClients) => {
  const clients = new Map<number, ExecutionClients>();

  const create = (chain: ChainData): ExecutionClients => {
    const publicClient = createPublicClient({
      chain: chain.chain,
      transport: http(
        `https://${chain.alchemyChain}.g.alchemy.com/v2/${encodeURIComponent(Redacted.value(config.alchemyApiKey))}`,
      ),
    });
    const paymasterClient = createPaymasterClient({
      transport: http(
        `https://api.pimlico.io/v2/${chain.chain.id}/rpc?apikey=${encodeURIComponent(Redacted.value(config.pimlicoApiKey))}`,
      ),
    });
    const bundlerClient = createBundlerClient({
      chain: chain.chain,
      client: publicClient,
      paymaster: paymasterClient,
      transport: http(
        `https://api.pimlico.io/v2/${chain.chain.id}/rpc?apikey=${encodeURIComponent(Redacted.value(config.pimlicoApiKey))}`,
      ),
    });

    return { publicClient, bundlerClient, paymasterClient };
  };

  return (chain: ChainData) => {
    const cached = clients.get(chain.chain.id);
    if (cached !== undefined) return cached;

    const created = create(chain);
    clients.set(chain.chain.id, created);
    return created;
  };
};
