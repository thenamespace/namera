import { QueryKeys } from "@/atoms/query-keys";
import {
  prepareWalletTransactionMutation,
  cancelWalletTransactionMutation,
  completeWalletTransactionMutation,
  walletTransactionAtom,
} from "@/atoms/wallet/transaction";
import { toMutation, toQuery } from "@/hooks/atom";

export const usePrepareWalletTransaction = toMutation(prepareWalletTransactionMutation);
export const useCancelWalletTransaction = toMutation(cancelWalletTransactionMutation, {
  invalidates: [...QueryKeys.identity.all, ...QueryKeys.billing.current],
});
export const useCompleteWalletTransaction = toMutation(completeWalletTransactionMutation, {
  invalidates: [...QueryKeys.identity.all, ...QueryKeys.billing.current],
});
export const useWalletTransaction = toQuery(walletTransactionAtom);
