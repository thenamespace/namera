import { chains } from "./data.js";
import type { ChainData } from "./data.js";

const byChainId = new Map<number, ChainData>();
const byCaip2 = new Map<string, ChainData>();

for (const data of Object.values(chains)) {
  byChainId.set(data.chain.id, data);
  byCaip2.set(data.chainId, data);
}

export const getChainDataByChainId = (chainId: number): ChainData | undefined =>
  byChainId.get(chainId);

export const getChainDataByCaip2 = (chainId: string): ChainData | undefined => byCaip2.get(chainId);
