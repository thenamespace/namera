import type { ExecutionListItemResponse } from "@namera-ai/protocol/dto";

import { actorDisplay, chainDataById } from "@/components/display";

export function getExecutionChain(item: ExecutionListItemResponse) {
  return chainDataById.get(item.details.chainId);
}

export function getTransactionUrl(item: ExecutionListItemResponse): string | undefined {
  const explorerUrl = getExecutionChain(item)?.chain.blockExplorers?.default.url;
  if (explorerUrl === undefined) return undefined;

  return `${explorerUrl.replace(/\/$/, "")}/tx/${item.details.transactionHash}`;
}

export function getActorLabel(item: ExecutionListItemResponse): string {
  return actorDisplay[item.actorType].label;
}
