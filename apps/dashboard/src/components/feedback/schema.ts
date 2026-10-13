import { Schema } from "effect";

import { FeedbackCategory, FeedbackData } from "@namera-ai/protocol/model";

export const FeedbackFormSchema = Schema.Struct({
  category: FeedbackCategory,
  message: FeedbackData.fields.message,
});
