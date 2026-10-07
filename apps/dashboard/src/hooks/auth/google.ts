import {
  googleConfigurationAtom,
  connectedAccountsAtom,
  startGoogleMutation,
  connectGoogleMutation,
  unlinkConnectedAccountMutation,
} from "@/atoms/auth/google";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useGoogleConfiguration = toQuery(() => googleConfigurationAtom);
export const useConnectedAccounts = toQuery(() => connectedAccountsAtom);
export const useStartGoogle = toMutation(startGoogleMutation);
export const useConnectGoogle = toMutation(connectGoogleMutation);
export const useUnlinkConnectedAccount = toMutation(unlinkConnectedAccountMutation, {
  invalidates: [...QueryKeys.connectedAccounts.lists, ...QueryKeys.notification.all],
});
