import type { EnsLabel, WalletId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const identitiesAtom = (walletId: WalletId, page = 1) =>
  NameraClient.query("identity", "list", {
    params: { walletId },
    query: { page },
    reactivityKeys: [...QueryKeys.organization.active, ...QueryKeys.identity.all],
    timeToLive: "30 seconds",
  });
export const identityAtom = (walletId: WalletId, label: EnsLabel) =>
  NameraClient.query("identity", "get", {
    params: { walletId, label },
    reactivityKeys: [...QueryKeys.organization.active, ...QueryKeys.identity.all],
    timeToLive: "30 seconds",
  });
export const identityNetworksAtom = NameraClient.query("identity", "networks", {
  reactivityKeys: QueryKeys.organization.active,
  timeToLive: "5 minutes",
});
export const createIdentityMutation = NameraClient.mutation("identity", "create");
export const updateIdentityRecordsMutation = NameraClient.mutation("identity", "updateRecords");
