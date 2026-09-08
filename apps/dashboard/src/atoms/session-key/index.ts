import type { SessionKeyId, WalletId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export * from "./operation";

export const sessionKeysAtom = NameraClient.query("sessionKey", "listForOrganization", {
  reactivityKeys: [
    ...QueryKeys.organization.active,
    ...QueryKeys.sessionKey.all,
    ...QueryKeys.sessionKey.lists,
    ...QueryKeys.sessionKey.organizationLists,
  ],
  timeToLive: "30 seconds",
});

export const walletSessionKeysAtom = (walletId: WalletId) =>
  NameraClient.query("sessionKey", "listForWallet", {
    params: { walletId },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.sessionKey.all,
      ...QueryKeys.sessionKey.lists,
      ...QueryKeys.sessionKey.walletLists,
      ...QueryKeys.sessionKey.walletList(walletId),
    ],
    timeToLive: "30 seconds",
  });

export const sessionKeyAtom = (sessionKeyId: SessionKeyId) =>
  NameraClient.query("sessionKey", "get", {
    params: { sessionKeyId },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.sessionKey.all,
      ...QueryKeys.sessionKey.details,
      ...QueryKeys.sessionKey.detail(sessionKeyId),
    ],
    timeToLive: "30 seconds",
  });

export const createSessionKeyMutation = NameraClient.mutation("sessionKey", "create");
export const revokeSessionKeyMutation = NameraClient.mutation("sessionKey", "revoke");
