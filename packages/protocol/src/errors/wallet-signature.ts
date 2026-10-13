import { Schema } from "effect";

export class WalletSignatureError extends Schema.TaggedError<WalletSignatureError>()(
  "WalletSignatureError",
  {
    code: Schema.Literals([
      "OWNER_UNAVAILABLE",
      "OPERATION_UNAVAILABLE",
      "OPERATION_BUSY",
      "APPROVAL_EXPIRED",
      "APPROVAL_INVALID",
      "PREPARATION_FAILED",
      "SIGNING_FAILED",
      "IDEMPOTENCY_CONFLICT",
    ]),
  },
  { httpApiStatus: 400 },
) {}
