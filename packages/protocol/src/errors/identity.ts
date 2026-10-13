import { Schema } from "effect";

export class IdentityPrimaryError extends Schema.TaggedError<IdentityPrimaryError>()(
  "IdentityPrimaryError",
  {
    code: Schema.Literals([
      "OWNER_UNAVAILABLE",
      "OPERATION_UNAVAILABLE",
      "OPERATION_BUSY",
      "APPROVAL_EXPIRED",
      "APPROVAL_INVALID",
      "PREPARATION_FAILED",
      "FORWARD_MISMATCH",
      "IDEMPOTENCY_CONFLICT",
    ]),
  },
  { httpApiStatus: 400 },
) {}

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
