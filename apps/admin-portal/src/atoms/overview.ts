import type { AdminOverviewPeriod } from "@namera-ai/protocol/dto";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const overviewAtom = (period: AdminOverviewPeriod = "30d") =>
  NameraClient.query("adminOverview", "get", {
    query: { period },
    reactivityKeys: QueryKeys.overview,
    timeToLive: "60 seconds",
  });
