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

export const freeBillingPlan = {
  key: "free",
  version: 1,
  period: {
    type: "monthly-anniversary",
    months: 1,
  },
  resources: freeResourceLimits,
  meters: freeMeters,
} as const;

/** Only Free v1 is assignable until paid-plan workflows are implemented. */
export const billingPlans = {
  free: freeBillingPlan,
} as const;
