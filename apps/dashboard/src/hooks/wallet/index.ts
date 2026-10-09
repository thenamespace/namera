import { QueryKeys } from "@/atoms/query-keys";
import {
  createPasskeyRegistrationOptionsMutation,
  createWalletMutation,
  refreshWalletPortfolioMutation,
  walletAtom,
  walletPasskeyOwnerAtom,
  walletPortfolioAtom,
  walletsAtom,
} from "@/atoms/wallet";
import { toMutation, toQuery } from "@/hooks/atom";

export const useWallets = toQuery(() => walletsAtom);
export const useWallet = toQuery(walletAtom);
export const useWalletPasskeyOwner = toQuery(walletPasskeyOwnerAtom);
export const useWalletPortfolio = toQuery(walletPortfolioAtom);
export const useCreateWallet = toMutation(createWalletMutation, {
  invalidates: [...QueryKeys.wallet.all, ...QueryKeys.wallet.lists],
});
export const useCreatePasskeyRegistrationOptions = toMutation(
  createPasskeyRegistrationOptionsMutation,
);

export const useRefreshWalletPortfolio = toMutation(refreshWalletPortfolioMutation, {
  invalidates: (input) => QueryKeys.wallet.assets(input.params.walletId),
});
