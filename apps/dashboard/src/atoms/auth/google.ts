import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const googleConfigurationAtom = NameraClient.query("google", "configuration", {
  timeToLive: "5 minutes",
});
export const connectedAccountsAtom = NameraClient.query("connectedAccounts", "list", {
  reactivityKeys: QueryKeys.connectedAccounts.lists,
  timeToLive: "30 seconds",
});
export const startGoogleMutation = NameraClient.mutation("google", "start");
export const connectGoogleMutation = NameraClient.mutation("connectedAccounts", "connectGoogle");
export const unlinkConnectedAccountMutation = NameraClient.mutation("connectedAccounts", "unlink");
