import type { WalletId, WalletOperationId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const prepareWalletTransactionMutation = NameraClient.mutation(
  "walletTransaction",
  "prepare",
);
export const cancelWalletTransactionMutation = NameraClient.mutation("walletTransaction", "cancel");
export const completeWalletTransactionMutation = NameraClient.mutation(
  "walletTransaction",
  "complete",
);
export const walletTransactionAtom = (walletId: WalletId, operationId: WalletOperationId) =>
  NameraClient.query("walletTransaction", "get", {
    params: { walletId, operationId },
    reactivityKeys: QueryKeys.organization.active,
    timeToLive: "5 seconds",
  });
