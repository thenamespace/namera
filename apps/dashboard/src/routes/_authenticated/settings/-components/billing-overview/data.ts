import type { BillingResourceKey } from "@namera-ai/protocol/dto";
import type { BillingMeterKey, BillingMeterUnit } from "@namera-ai/protocol/model";
import type { IconSvgElement } from "@namera-ai/ui/icons";
import {
  Activity01Icon,
  Activity02Icon,
  FuelStationIcon,
  ShieldUserIcon,
  SignatureIcon,
  UserMultiple02Icon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";

type UsageDefinition<Key extends string> = {
  readonly description: string;
  readonly icon: IconSvgElement;
  readonly key: Key;
  readonly label: string;
};

export const resourceDefinitions: ReadonlyArray<UsageDefinition<BillingResourceKey>> = [
  {
    key: "members",
    label: "Members",
    description: "Members and pending invitations",
    icon: UserMultiple02Icon,
  },
  {
    key: "software-wallets",
    label: "Software accounts",
    description: "Accounts secured with software keys",
    icon: Wallet01Icon,
  },
  {
    key: "hsm-wallets",
    label: "HSM accounts",
    description: "Accounts secured with managed keys",
    icon: ShieldUserIcon,
  },
];

export const meterDefinitions: ReadonlyArray<UsageDefinition<BillingMeterKey>> = [
  {
    key: "execution.mainnet",
    label: "Mainnet executions",
    description: "Confirmed mainnet transactions",
    icon: Activity01Icon,
  },
  {
    key: "execution.testnet",
    label: "Testnet executions",
    description: "Confirmed testnet transactions",
    icon: Activity02Icon,
  },
  {
    key: "signature",
    label: "Signatures",
    description: "Messages and typed data signed",
    icon: SignatureIcon,
  },
  {
    key: "gas-sponsorship",
    label: "Sponsored gas",
    description: "Mainnet gas paid by Namera",
    icon: FuelStationIcon,
  },
];

const countFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const usdFormatter = new Intl.NumberFormat(undefined, {
  currency: "USD",
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
