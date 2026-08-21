import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const billingAtom = NameraClient.query("billing", "get", {
  reactivityKeys: [...QueryKeys.organization.active, ...QueryKeys.billing.current],
  timeToLive: "30 seconds",
});
