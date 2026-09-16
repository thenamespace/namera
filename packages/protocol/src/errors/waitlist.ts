import { Schema } from "effect";

export class WaitlistNotFoundError extends Schema.TaggedError<WaitlistNotFoundError>()(
  "WaitlistNotFoundError",
  { code: Schema.Literal("WAITLIST_NOT_FOUND") },
  { httpApiStatus: 404 },
) {}
