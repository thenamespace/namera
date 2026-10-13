import { QueryKeys } from "@/atoms/query-keys";
import {
  prepareWalletTransactionMutation,
  completeWalletTransactionMutation,
  walletTransactionAtom,
} from "@/atoms/wallet/transaction";
import { toMutation, toQuery } from "@/hooks/atom";

export const usePrepareWalletTransaction = toMutation(prepareWalletTransactionMutation);
export const useCompleteWalletTransaction = toMutation(completeWalletTransactionMutation, {
  invalidates: [...QueryKeys.identity.all, ...QueryKeys.billing.current],
});
export const useWalletTransaction = toQuery(walletTransactionAtom);
