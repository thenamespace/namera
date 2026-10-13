import { Schema } from "effect";

export class IdentityError extends Schema.TaggedError<IdentityError>()(
  "IdentityError",
  {
    code: Schema.Literals([
      "NAME_UNAVAILABLE",
      "IDENTITY_UNAVAILABLE",
      "INVALID_RECORD",
      "PARTIAL_UPDATE",
    ]),
    applied: Schema.optional(Schema.Number),
  },
  { httpApiStatus: 400 },
) {}
