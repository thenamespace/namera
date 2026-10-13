import { NameraClient } from "@/atoms/client";

export const prepareWalletSignatureMutation = NameraClient.mutation("walletSignature", "prepare");
export const completeWalletSignatureMutation = NameraClient.mutation("walletSignature", "complete");
