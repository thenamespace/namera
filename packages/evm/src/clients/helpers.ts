import { createPublicClient as createViemPublicClient, http } from "viem";
import type { PublicClient } from "viem";

import type { ChainData } from "../chains/data.js";

export const createPublicClient = (chain: ChainData, apiKey: string): PublicClient =>
  createViemPublicClient({
    chain: chain.chain,
    transport: http(`https://${chain.alchemyChain}.g.alchemy.com/v2/${encodeURIComponent(apiKey)}`),
  });
