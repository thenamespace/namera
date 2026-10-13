import type { ListFeedbackRequest } from "@namera-ai/protocol/dto";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const feedbackAtom = (query: ListFeedbackRequest = {}) =>
  NameraClient.query("adminFeedback", "list", {
    query: { limit: 25, ...query },
    reactivityKeys: QueryKeys.feedback.all,
    timeToLive: "30 seconds",
  });
export const feedbackDetailAtom = (id: string) =>
  NameraClient.query("adminFeedback", "get", {
    params: { id },
    reactivityKeys: QueryKeys.feedback.all,
    timeToLive: "30 seconds",
  });
export const updateFeedbackStatusMutation = NameraClient.mutation("adminFeedback", "updateStatus");
