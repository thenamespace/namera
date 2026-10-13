import { Schema } from "effect";

export class WalletTransactionError extends Schema.TaggedError<WalletTransactionError>()(
  "WalletTransactionError",
  {
    code: Schema.Literals([
      "OWNER_UNAVAILABLE",
      "OPERATION_UNAVAILABLE",
      "OPERATION_BUSY",
      "APPROVAL_EXPIRED",
      "APPROVAL_INVALID",
      "PREPARATION_FAILED",
      "INSUFFICIENT_FUNDS",
      "IDEMPOTENCY_CONFLICT",
    ]),
  },
  { httpApiStatus: 400 },
) {}
