import { Schema } from "effect";

export class FeedbackNotFoundError extends Schema.TaggedError<FeedbackNotFoundError>()(
  "FeedbackNotFoundError",
  { id: Schema.String },
  { httpApiStatus: 404 },
) {}
