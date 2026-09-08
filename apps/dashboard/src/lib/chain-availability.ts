import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type { SupportedEvmChainId } from "@namera-ai/protocol";

export const isChainOperationEnabled = (chainId: SupportedEvmChainId): boolean =>
  getChainDataByCaip2(chainId)?.operationsEnabled === true;
