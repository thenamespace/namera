import { QueryKeys } from "@/atoms/query-keys";
import { createWalletMutation, walletAssetsAtom, walletAtom, walletsAtom } from "@/atoms/wallet";
import { toMutation, toQuery } from "@/hooks/atom";

export const useWallets = toQuery(() => walletsAtom);
export const useWallet = toQuery(walletAtom);
export const useWalletAssets = toQuery(walletAssetsAtom);
export const useCreateWallet = toMutation(createWalletMutation, {
  invalidates: [...QueryKeys.wallet.all, ...QueryKeys.wallet.lists],
});
