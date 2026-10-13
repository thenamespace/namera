import { createFeedbackMutation } from "@/atoms/feedback";
import { toMutation } from "@/hooks/atom";

export const useCreateFeedback = toMutation(createFeedbackMutation);
