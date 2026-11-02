import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { createPublicClient, http, type Address } from "viem";

import { env } from "@/env";

export async function subregistryInputError(input: {
  readonly chainId: SupportedEvmChainId;
  readonly registry: Address;
  readonly account: Address;
}): Promise<string | undefined> {
  const chain = getChainDataByCaip2(input.chainId);
  if (!chain?.operationsEnabled) return "Choose an available network.";

  const { reviewSubregistry } = await import("@namera-ai/evm/identity-review");
  const review = await reviewSubregistry(
    input,
    createPublicClient({
      chain: chain.chain,
      transport: http(`${env.backendUrl}/rpc/eip155/${chain.chain.id}`, {
        retryCount: 0,
        timeout: 15_000,
      }),
    }),
  );

  switch (review) {
    case "ready":
      return undefined;
    case "not-contract":
      return "No contract is deployed at this address on the selected network.";
    case "not-registry":
      return "Enter an ENSv2 permissioned registry address.";
    case "missing-role":
      return "This account does not have the registrar role on this registry.";
  }
}
