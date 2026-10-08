import type { ListWaitlistRequest } from "@namera-ai/protocol/dto";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const waitlistAtom = (query: ListWaitlistRequest = {}) =>
  NameraClient.query("adminWaitlist", "list", {
    query: { limit: 25, ...query },
    reactivityKeys: QueryKeys.waitlist.list,
    timeToLive: "30 seconds",
  });
export const acceptWaitlistMutation = NameraClient.mutation("adminWaitlist", "accept");
