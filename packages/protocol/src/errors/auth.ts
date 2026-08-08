import { Schema } from "effect";

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  "Forbidden",
  {
    code: Schema.Literals(["ACTOR_NOT_ALLOWED", "INSUFFICIENT_PERMISSIONS"]),
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 403 },
) {}
