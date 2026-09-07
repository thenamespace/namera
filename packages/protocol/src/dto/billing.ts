import { Schema } from "effect";

import { BillingPeriodId, OrganizationId } from "#/common/index";
import {
  BillingMeterKey,
  BillingMeterUnit,
  BillingPlan,
  BillingSubscriptionStatus,
} from "#/model/index";

const NonNegativeAmount = Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n));

export const BillingResourceKey = Schema.Literals([
  "members",
  "software-wallets",
  "hsm-wallets",
  "local-wallets",
]);

export const BillingResourceUsage = Schema.Struct({
  key: BillingResourceKey,
  includedAmount: NonNegativeAmount,
  usedAmount: NonNegativeAmount,
  remainingAmount: NonNegativeAmount,
});

export const BillingMeterUsage = Schema.Struct({
  key: BillingMeterKey,
  unit: BillingMeterUnit,
  includedAmount: NonNegativeAmount,
  hardLimitAmount: Schema.NullOr(NonNegativeAmount),
  consumedAmount: NonNegativeAmount,
  reservedAmount: NonNegativeAmount,
  remainingAmount: Schema.NullOr(NonNegativeAmount),
});

export const GetBillingResponse = Schema.Struct({
  organizationId: OrganizationId,
  plan: BillingPlan,
  planVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  status: BillingSubscriptionStatus,
  period: Schema.Struct({
    id: BillingPeriodId,
    startsAt: Schema.DateTimeUtcFromDate,
    endsAt: Schema.DateTimeUtcFromDate,
  }),
  resources: Schema.Array(BillingResourceUsage),
  meters: Schema.Array(BillingMeterUsage),
}).annotate({
  identifier: "GetBillingResponse",
  description: "Current anniversary period, resource entitlements, and metered usage",
});

export type BillingResourceKey = typeof BillingResourceKey.Type;
export type BillingResourceUsage = typeof BillingResourceUsage.Type;
export type BillingMeterUsage = typeof BillingMeterUsage.Type;
export type GetBillingResponse = typeof GetBillingResponse.Type;
