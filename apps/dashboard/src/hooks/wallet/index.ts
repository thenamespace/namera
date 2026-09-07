import { QueryKeys } from "@/atoms/query-keys";
import {
  createPasskeyRegistrationOptionsMutation,
  createWalletMutation,
  walletAtom,
  walletPortfolioAtom,
  walletsAtom,
} from "@/atoms/wallet";
import { toMutation, toQuery } from "@/hooks/atom";

export const useWallets = toQuery(() => walletsAtom);
export const useWallet = toQuery(walletAtom);
export const useWalletPortfolio = toQuery(walletPortfolioAtom);
export const useCreateWallet = toMutation(createWalletMutation, {
  invalidates: [...QueryKeys.wallet.all, ...QueryKeys.wallet.lists],
});
export const useCreatePasskeyRegistrationOptions = toMutation(
  createPasskeyRegistrationOptionsMutation,
);
