import { Redacted } from "effect";

import { createSmartAccountClient } from "permissionless";
import type { SmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import type { PimlicoClient } from "permissionless/clients/pimlico";
import { createPublicClient, http } from "viem";
import type { PublicClient } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import type { SmartAccount } from "viem/account-abstraction";

import type { ChainData } from "../chains/data.js";
import type { EvmConfigValues } from "../config.js";

export type ExecutionClients = {
  readonly publicClient: PublicClient;
  readonly pimlicoClient: PimlicoClient<"0.7">;
  readonly createSmartAccountClient: (
    account: SmartAccount,
    sponsorship: "none" | "pimlico",
  ) => SmartAccountClient;
};

export const makeExecutionClients = (
  config: EvmConfigValues,
): ((chain: ChainData) => ExecutionClients) => {
  const clients = new Map<number, ExecutionClients>();

  const create = (chain: ChainData): ExecutionClients => {
    const pimlicoUrl = `https://api.pimlico.io/v2/${chain.chain.id}/rpc?apikey=${encodeURIComponent(Redacted.value(config.pimlicoApiKey))}`;
    const publicClient = createPublicClient({
      chain: chain.chain,
      transport: http(
        `https://${chain.alchemyChain}.g.alchemy.com/v2/${encodeURIComponent(Redacted.value(config.alchemyApiKey))}`,
      ),
    });
    const pimlicoClient = createPimlicoClient({
      chain: chain.chain,
      transport: http(pimlicoUrl),
      entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
      },
    });

    return {
      publicClient,
      pimlicoClient,
      createSmartAccountClient: (account, sponsorship) =>
        createSmartAccountClient({
          account,
          chain: chain.chain,
          client: publicClient,
          bundlerTransport: http(pimlicoUrl),
          ...(sponsorship === "pimlico" ? { paymaster: pimlicoClient } : {}),
          userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
          },
        }),
    };
  };

  return (chain: ChainData) => {
    const cached = clients.get(chain.chain.id);
    if (cached !== undefined) return cached;

    const created = create(chain);
    clients.set(chain.chain.id, created);
    return created;
  };
};
