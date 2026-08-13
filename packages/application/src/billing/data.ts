import type { BillingPlan, BillingPlanLimits } from "@namera-ai/protocol/model";

export const billingPlans = {
  free: {
    version: 1,
    monthlyPriceUsd: 0,
    executionOveragePriceUsd: null,
    limits: {
      maxMembers: 5,
      maxSoftwareWallets: 5,
      maxHsmWallets: 0,
      includedExecutions: 100,
    },
  },
} as const satisfies Readonly<
  Record<
    BillingPlan,
    {
      readonly version: number;
      readonly monthlyPriceUsd: number;
      readonly executionOveragePriceUsd: number | null;
      readonly limits: BillingPlanLimits;
    }
  >
>;
