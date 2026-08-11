import { createPublicClient as createViemPublicClient, http } from "viem";
import {
  createBundlerClient as createViemBundlerClient,
  createPaymasterClient as createViemPaymasterClient,
} from "viem/account-abstraction";

import type { ChainData } from "../chains/data.js";

type PublicClient = ReturnType<typeof createViemPublicClient>;
type BundlerClient = ReturnType<typeof createViemBundlerClient>;
type PaymasterClient = ReturnType<typeof createViemPaymasterClient>;

export const createPublicClient = (chain: ChainData, apiKey: string): PublicClient =>
  createViemPublicClient({
    chain: chain.chain,
    transport: http(`https://${chain.alchemyChain}.g.alchemy.com/v2/${encodeURIComponent(apiKey)}`),
  });

export const createBundlerClient = (chain: ChainData, apiKey: string): BundlerClient =>
  createViemBundlerClient({
    chain: chain.chain,
    transport: http(
      `https://api.pimlico.io/v2/${chain.chain.id}/rpc?apikey=${encodeURIComponent(apiKey)}`,
    ),
  });

export const createPaymasterClient = (chain: ChainData, apiKey: string): PaymasterClient =>
  createViemPaymasterClient({
    transport: http(
      `https://api.pimlico.io/v2/${chain.chain.id}/rpc?apikey=${encodeURIComponent(apiKey)}`,
    ),
  });
