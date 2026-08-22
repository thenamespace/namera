import type { ExecutionId, SessionKeyId, WalletId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const executionsAtom = NameraClient.query("execution", "list", {
  query: {},
  reactivityKeys: [
    ...QueryKeys.organization.active,
    ...QueryKeys.execution.all,
    ...QueryKeys.execution.lists,
  ],
  timeToLive: "30 seconds",
});

export const walletExecutionsAtom = (walletId: WalletId) =>
  NameraClient.query("execution", "list", {
    query: { walletId },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.execution.all,
      ...QueryKeys.execution.lists,
      ...QueryKeys.execution.walletList(walletId),
    ],
    timeToLive: "30 seconds",
  });

export const sessionKeyExecutionsAtom = (sessionKeyId: SessionKeyId) =>
  NameraClient.query("execution", "list", {
    query: { sessionKeyId },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.execution.all,
      ...QueryKeys.execution.lists,
      ...QueryKeys.execution.sessionKeyList(sessionKeyId),
    ],
    timeToLive: "30 seconds",
  });

export const executionAtom = (executionId: ExecutionId) =>
  NameraClient.query("execution", "get", {
    params: { executionId },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.execution.all,
      ...QueryKeys.execution.details,
      ...QueryKeys.execution.detail(executionId),
    ],
    timeToLive: "30 seconds",
  });
