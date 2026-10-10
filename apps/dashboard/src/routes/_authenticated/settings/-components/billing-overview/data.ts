import type { BillingResourceKey } from "@namera-ai/protocol/dto";
import type { BillingMeterKey, BillingMeterUnit } from "@namera-ai/protocol/model";

type UsageDefinition<Key extends string> = {
  readonly key: Key;
  readonly label: string;
  readonly planLabel: string;
};

export const resourceDefinitions: ReadonlyArray<UsageDefinition<BillingResourceKey>> = [
  {
    key: "members",
    label: "Members",
    planLabel: "members",
  },
  {
    key: "local-wallets",
    label: "User-owned accounts",
    planLabel: "user-owned accounts",
  },
  {
    key: "local-session-keys",
    label: "Self-owned session keys",
    planLabel: "self-owned session keys",
  },
  {
    key: "oneclaw-wallets",
    label: "1Claw-managed accounts (coming soon)",
    planLabel: "1Claw-managed accounts (coming soon)",
  },
  {
    key: "oneclaw-session-keys",
    label: "1Claw-managed session keys (coming soon)",
    planLabel: "1Claw-managed session keys (coming soon)",
  },
];

export const meterDefinitions: ReadonlyArray<UsageDefinition<BillingMeterKey>> = [
  {
    key: "execution.mainnet",
    label: "Mainnet executions",
    planLabel: "mainnet executions",
  },
  {
    key: "execution.testnet",
    label: "Testnet executions",
    planLabel: "testnet executions",
  },
  {
    key: "signature",
    label: "Signatures",
    planLabel: "signatures",
  },
  {
    key: "gas-sponsorship",
    label: "Sponsored gas",
    planLabel: "in sponsored gas",
  },
];

const countFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const usdFormatter = new Intl.NumberFormat(undefined, {
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency",
});

export function formatBillingAmount(amount: bigint, unit: BillingMeterUnit | "resource") {
  return unit === "micro-usd"
    ? usdFormatter.format(Number(amount) / 1_000_000)
    : countFormatter.format(amount);
}

export function getMeterColor(value: bigint, maximum: bigint) {
  if (maximum === 0n) return "default" as const;
  const percentage = Number((value * 100n) / maximum);
  if (percentage >= 90) return "danger" as const;
  if (percentage >= 75) return "warning" as const;
  return "accent" as const;
}
