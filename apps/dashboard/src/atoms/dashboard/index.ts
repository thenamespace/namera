import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const dashboardOverviewAtom = NameraClient.query("dashboard", "getOverview", {
  reactivityKeys: [
    ...QueryKeys.organization.active,
    ...QueryKeys.dashboard.overview,
    ...QueryKeys.wallet.all,
    ...QueryKeys.sessionKey.all,
    ...QueryKeys.execution.all,
    ...QueryKeys.billing.current,
  ],
  timeToLive: "30 seconds",
});
