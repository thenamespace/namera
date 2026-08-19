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
import type { ExecutionId } from "@namera-ai/protocol";
