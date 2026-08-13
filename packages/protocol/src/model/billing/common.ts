import { Schema } from "effect";

export const BillingPlan = Schema.Literals(["free"]);
export const BillingProvider = Schema.Literals(["stripe"]);
export const BillingCurrency = Schema.Literals(["usd"]);

export const BillingPlanLimits = Schema.Struct({
  maxMembers: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  maxSoftwareWallets: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  maxHsmWallets: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  includedExecutions: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type BillingPlan = typeof BillingPlan.Type;
export type BillingProvider = typeof BillingProvider.Type;
export type BillingCurrency = typeof BillingCurrency.Type;
export type BillingPlanLimits = typeof BillingPlanLimits.Type;
