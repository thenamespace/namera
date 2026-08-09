import { Schema } from "effect";

export class RateLimitExceeded extends Schema.TaggedError<RateLimitExceeded>()(
  "RateLimitExceeded",
  {
    retryAfterSeconds: Schema.Int,
  },
  {
    description: "The request exceeded an enforced rate limit",
    httpApiStatus: 429,
  },
) {}
