// Free v2 mirrors application/billing/data.ts. Paid tiers are planning figures,
// not assignable subscriptions or purchasable offers.
export type PlanId = "free" | "pro" | "business" | "enterprise";

type Plan = {
  readonly id: PlanId;
  readonly name: string;
  readonly price: string;
  readonly cadence?: string;
  readonly summary: string;
  readonly available: boolean;
  readonly action: "waitlist" | "contact" | "none";
  readonly features: readonly string[];
};

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    summary: "Available in private beta",
    available: true,
    action: "waitlist",
    features: [
      "5 members per workspace",
      "10 self-owned accounts",
      "100 self-owned session keys",
      "100 mainnet executions",
      "500 testnet executions",
      "1,000 signatures",
      "$3 of sponsored gas, fees included",
      "Coming soon: 3 managed accounts and 5 managed session keys with 1Claw",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    cadence: "per month, planned",
    summary: "Coming later. Limits may change.",
    available: false,
    action: "none",
    features: [
      "10 members",
      "50 self-owned accounts",
      "500 self-owned session keys",
      "10 managed accounts and 25 managed session keys with 1Claw",
      "1,000 mainnet and 2,000 testnet executions",
      "5,000 signatures",
      "$5 of sponsored gas, fees included",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "$149",
    cadence: "per month, planned",
    summary: "Coming later. Limits may change.",
    available: false,
    action: "none",
    features: [
      "50 members",
      "250 self-owned accounts",
      "2,500 self-owned session keys",
      "50 managed accounts and 100 managed session keys with 1Claw",
      "5,000 mainnet and 15,000 testnet executions",
      "25,000 signatures",
      "$15 of sponsored gas, fees included",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    summary: "Tell us what you need",
    available: false,
    action: "contact",
    features: [
      "Discuss your account and signing volume",
      "Custom limits and support requirements",
      "Not available for purchase yet",
    ],
  },
];

type Row = {
  readonly label: string;
  readonly note?: string;
  readonly values: Readonly<Record<PlanId, string>>;
};
type Group = { readonly title: string; readonly note?: string; readonly rows: readonly Row[] };

export const GROUPS: readonly Group[] = [
  {
    title: "Workspace capacity",
    note: "Per workspace. These limits do not reset each month. Paid-plan limits are planned, not available today.",
    rows: [
      {
        label: "Members",
        note: "Includes pending invitations.",
        values: { free: "5", pro: "10", business: "50", enterprise: "Custom" },
      },
      {
        label: "Self-owned smart accounts",
        values: { free: "10", pro: "50", business: "250", enterprise: "Custom" },
      },
      {
        label: "1Claw-managed smart accounts",
        note: "Creation coming soon.",
        values: { free: "3", pro: "10", business: "50", enterprise: "Custom" },
      },
      {
        label: "Self-owned session keys",
        note: "Pending and active unexpired keys count. A key on multiple networks uses one slot.",
        values: { free: "100", pro: "500", business: "2,500", enterprise: "Custom" },
      },
      {
        label: "1Claw-managed session keys",
        note: "Creation coming soon.",
        values: { free: "5", pro: "25", business: "100", enterprise: "Custom" },
      },
    ],
  },
  {
    title: "Each month",
    note: "Resets on your workspace’s monthly anniversary, not the first of the month.",
    rows: [
      {
        label: "Mainnet executions",
        note: "Confirmed operations, including session-key installation and removal.",
        values: { free: "100", pro: "1,000", business: "5,000", enterprise: "Custom" },
      },
      {
        label: "Testnet executions",
        values: { free: "500", pro: "2,000", business: "15,000", enterprise: "Custom" },
      },
      {
        label: "Signatures",
        note: "Signing operations completed through Namera.",
        values: { free: "1,000", pro: "5,000", business: "25,000", enterprise: "Custom" },
      },
      {
        label: "Sponsored gas",
        note: "Provider-reported gas cost including the sponsorship fee.",
        values: { free: "$3", pro: "$5", business: "$15", enterprise: "Custom" },
      },
      {
        label: "Overages",
        values: {
          free: "No overages",
          pro: "Not available",
          business: "Not available",
          enterprise: "To discuss",
        },
      },
    ],
  },
];
