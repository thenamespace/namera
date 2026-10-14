import type { ListFeedbackRequest } from "@namera-ai/protocol/dto";

import { feedbackAtom, feedbackDetailAtom, updateFeedbackStatusMutation } from "@/atoms/feedback";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useFeedback = toQuery((query: ListFeedbackRequest) => feedbackAtom(query));
export const useFeedbackDetail = toQuery((id: string) => feedbackDetailAtom(id));
export const useUpdateFeedbackStatus = toMutation(updateFeedbackStatusMutation, {
  invalidates: QueryKeys.feedback.all,
});
