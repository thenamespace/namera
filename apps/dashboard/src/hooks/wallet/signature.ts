import {
  prepareWalletSignatureMutation,
  completeWalletSignatureMutation,
} from "@/atoms/wallet/signature";
import { toMutation } from "@/hooks/atom";

export const usePrepareWalletSignature = toMutation(prepareWalletSignatureMutation);
export const useCompleteWalletSignature = toMutation(completeWalletSignatureMutation);
