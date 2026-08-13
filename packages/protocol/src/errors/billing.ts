import { Schema } from "effect";

export const BillingLimit = Schema.Literals([
  "members",
  "softwareWallets",
  "hsmWallets",
  "executions",
]);

export class BillingLimitExceededError extends Schema.TaggedError<BillingLimitExceededError>()(
  "BillingError",
  {
    code: Schema.Literal("LIMIT_EXCEEDED"),
    limit: BillingLimit,
    message: Schema.optional(Schema.String),
  },
  { httpApiStatus: 409 },
) {}

export const BillingErrors = [BillingLimitExceededError] as const;
export const BillingError = Schema.Union(BillingErrors);

export type BillingLimit = typeof BillingLimit.Type;
export type BillingError = typeof BillingError.Type;
