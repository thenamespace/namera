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
      includedSignatures: 10_000,
    },
  },
  pro: {
    version: 1,
    monthlyPriceUsd: 49,
    executionOveragePriceUsd: 0.02,
    limits: {
      maxMembers: 20,
      maxSoftwareWallets: 20,
      maxHsmWallets: 3,
      includedExecutions: 2_000,
      includedSignatures: 250_000,
    },
  },
  business: {
    version: 1,
    monthlyPriceUsd: 249,
    executionOveragePriceUsd: 0.02,
    limits: {
      maxMembers: 100,
      maxSoftwareWallets: 100,
      maxHsmWallets: 10,
      includedExecutions: 10_000,
      includedSignatures: 1_000_000,
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
