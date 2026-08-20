import { Schema } from "effect";

export const BillingPlan = Schema.Literals(["free", "pro", "business"]);
export const BillingProvider = Schema.Literals(["stripe"]);
export const BillingCurrency = Schema.Literals(["usd"]);

/** Stable code-owned keys for the components Stripe can bill. */
export const BillingSubscriptionComponentKey = Schema.Literals([
  "plan.base",
  "wallet.software",
  "wallet.hsm",
  "execution.mainnet",
  "signature",
  "gas-sponsorship",
]);

/** Stable code-owned meters used by limits, balances, and usage events. */
export const BillingMeterKey = Schema.Literals([
  "execution.mainnet",
  "execution.testnet",
  "signature",
  "gas-sponsorship",
]);

export const BillingMeterUnit = Schema.Literals(["operation", "micro-usd"]);
export const BillingUsageSourceType = Schema.Literals([
  "execution-submission",
  "signature-operation",
  "manual-adjustment",
]);

export const BillingPlanLimits = Schema.Struct({
  maxMembers: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  maxSoftwareWallets: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  maxHsmWallets: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  includedExecutions: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  includedSignatures: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type BillingPlan = typeof BillingPlan.Type;
export type BillingProvider = typeof BillingProvider.Type;
export type BillingCurrency = typeof BillingCurrency.Type;
export type BillingSubscriptionComponentKey = typeof BillingSubscriptionComponentKey.Type;
export type BillingMeterKey = typeof BillingMeterKey.Type;
export type BillingMeterUnit = typeof BillingMeterUnit.Type;
export type BillingUsageSourceType = typeof BillingUsageSourceType.Type;
export type BillingPlanLimits = typeof BillingPlanLimits.Type;
