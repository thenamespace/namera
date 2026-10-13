import type { ListFeedbackRequest } from "@namera-ai/protocol/dto";

import { feedbackAtom, feedbackDetailAtom, updateFeedbackStatusMutation } from "@/atoms/feedback";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export function useFeedback(query: ListFeedbackRequest) {
  return toQuery(() => feedbackAtom(query))();
}
export function useFeedbackDetail(id: string) {
  return toQuery(() => feedbackDetailAtom(id))();
}
export const useUpdateFeedbackStatus = toMutation(updateFeedbackStatusMutation, {
  invalidates: QueryKeys.feedback.all,
});
