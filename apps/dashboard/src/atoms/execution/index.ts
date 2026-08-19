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
