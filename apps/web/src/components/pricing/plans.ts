// Free v2 mirrors application/billing/data.ts. Paid tiers are planning figures,
// not assignable subscriptions or purchasable offers.
export type PlanId = "free" | "pro" | "business" | "enterprise";

type Plan = {
  readonly id: PlanId;
  readonly name: string;
  readonly price: string;
  readonly cadence?: string;
  readonly action: "signup" | "contact" | "none";
  readonly features: readonly string[];
};

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    action: "signup",
    features: [
      "5 members per workspace",
      "10 user-owned accounts",
      "3 managed accounts",
      "100 local session keys",
      "5 managed session keys",
      "100 mainnet executions",
      "500 testnet executions",
      "1,000 signatures",
      "$3 of sponsored gas",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    cadence: "per month, planned",
    action: "none",
    features: [
      "10 members",
      "50 user-owned accounts",
      "10 managed accounts",
      "500 local session keys",
      "25 managed session keys",
      "1,000 mainnet and 2,000 testnet executions",
      "5,000 signatures",
      "$5 of sponsored gas",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "$149",
    cadence: "per month, planned",
    action: "none",
    features: [
      "50 members",
      "250 user-owned accounts",
      "50 managed accounts",
      "2,500 local session keys",
      "100 managed session keys",
      "5,000 mainnet and 15,000 testnet executions",
      "25,000 signatures",
      "$15 of sponsored gas",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    action: "contact",
    features: [
      "Member limits tailored to your team",
      "Custom user-owned account limits",
      "Custom managed account limits",
      "Custom local session key limits",
      "Custom managed session key limits",
      "Custom mainnet and testnet executions",
      "Custom signature allowance",
      "Custom sponsored gas allowance",
    ],
  },
];

type Row = {
  readonly label: string;
  readonly note?: string;
  readonly values: Readonly<Record<PlanId, string>>;
};
type Group = { readonly title?: string; readonly rows: readonly Row[] };

export const GROUPS: readonly Group[] = [
  {
    rows: [
      {
        label: "Members",
        note: "Includes pending invitations.",
        values: { free: "5", pro: "10", business: "50", enterprise: "Custom" },
      },
      {
        label: "User-owned accounts",
        values: { free: "10", pro: "50", business: "250", enterprise: "Custom" },
      },
      {
        label: "Managed accounts",
        values: { free: "3", pro: "10", business: "50", enterprise: "Custom" },
      },
      {
        label: "Local session keys",
        note: "Pending and active unexpired keys count. A key on multiple networks uses one slot.",
        values: { free: "100", pro: "500", business: "2,500", enterprise: "Custom" },
      },
      {
        label: "Managed session keys",
        values: { free: "5", pro: "25", business: "100", enterprise: "Custom" },
      },
    ],
  },
  {
    title: "Each month",
    rows: [
      {
        label: "Mainnet executions",
        note: "Successful operations, including ENS operations and session-key installation and removal.",
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
