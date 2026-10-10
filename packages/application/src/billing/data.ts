import type { BillingMeterKey, BillingMeterUnit } from "@namera-ai/protocol/model";

export interface BillingMeterDefinition {
  readonly key: BillingMeterKey;
  readonly version: number;
  readonly unit: BillingMeterUnit;
  readonly includedAmount: bigint;
  readonly hardLimitAmount: bigint | null;
}

const freeResourceLimits = {
  maxMembers: 5,
  maxSoftwareWallets: 5,
  maxHsmWallets: 0,
  maxLocalWallets: 50,
  maxOneClawWallets: 0,
  maxLocalSessionKeys: null,
  maxOneClawSessionKeys: 0,
} as const;

const freeMeters = {
  "execution.mainnet": {
    key: "execution.mainnet",
    version: 1,
    unit: "operation",
    includedAmount: 100n,
    hardLimitAmount: 100n,
  },
  "execution.testnet": {
    key: "execution.testnet",
    version: 1,
    unit: "operation",
    includedAmount: 1_000n,
    hardLimitAmount: 1_000n,
  },
  signature: {
    key: "signature",
    version: 1,
    unit: "operation",
    includedAmount: 10_000n,
    hardLimitAmount: 10_000n,
  },
  "gas-sponsorship": {
    key: "gas-sponsorship",
    version: 1,
    unit: "micro-usd",
    includedAmount: 3_000_000n,
    hardLimitAmount: 3_000_000n,
  },
} as const satisfies Readonly<Record<BillingMeterKey, BillingMeterDefinition>>;

export const legacyFreeBillingPlan = {
  key: "free",
  version: 1,
  period: {
    type: "monthly-anniversary",
    months: 1,
  },
  resources: freeResourceLimits,
  meters: freeMeters,
} as const;

export const freeBillingPlan = {
  ...legacyFreeBillingPlan,
  version: 2,
  resources: {
    ...freeResourceLimits,
    maxSoftwareWallets: 0,
    maxLocalWallets: 10,
    maxOneClawWallets: 3,
    maxLocalSessionKeys: 100,
    maxOneClawSessionKeys: 5,
  },
  meters: {
    ...freeMeters,
    "execution.testnet": {
      ...freeMeters["execution.testnet"],
      includedAmount: 500n,
      hardLimitAmount: 500n,
    },
    signature: { ...freeMeters.signature, includedAmount: 1_000n, hardLimitAmount: 1_000n },
  },
} as const;

export const maxOwnedOrganizations = 3;
export type FreeBillingPlan = typeof legacyFreeBillingPlan | typeof freeBillingPlan;

export const resolveBillingPlan = (selection: {
  readonly plan: string;
  readonly planVersion: number;
}): FreeBillingPlan => {
  if (selection.plan === "free") {
    if (selection.planVersion === 1) return legacyFreeBillingPlan;
    if (selection.planVersion === 2) return freeBillingPlan;
  }
  throw new Error(`Unsupported billing plan version: ${selection.plan}@${selection.planVersion}`);
};

/** Paid plans remain unavailable. Historical Free v1 stays readable. */
export const billingPlans = {
  free: freeBillingPlan,
} as const;
