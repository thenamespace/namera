import {
  ApiIcon,
  ComputerTerminal01Icon,
  DashboardSquare01Icon,
  InboxIcon,
  Key01Icon,
  Login03Icon,
  SafeIcon,
  Settings02Icon,
  Shield01Icon,
  TaskDone01Icon,
} from "@namera-ai/ui/icons";

// Static examples for the landing-page preview; these are not live account data.
export type Section = "Overview" | "Inbox" | "Accounts" | "Session Keys" | "Activity";
export type Tab = "Overview" | "Policies" | "Usage";
export type Range = "Daily" | "Weekly" | "Monthly";

export const NAV = [
  {
    group: "Primary",
    items: [
      { label: "Overview", icon: DashboardSquare01Icon },
      { label: "Inbox", icon: InboxIcon },
    ],
  },
  {
    group: "Core",
    items: [
      { label: "Accounts", icon: Shield01Icon },
      { label: "Session Keys", icon: Key01Icon },
      { label: "Activity", icon: TaskDone01Icon },
    ],
  },
  { group: "Admin", items: [{ label: "Settings", icon: Settings02Icon }] },
] as const;

export const SECTIONS: readonly Section[] = [
  "Overview",
  "Inbox",
  "Accounts",
  "Session Keys",
  "Activity",
];
export const SWITCHABLE = new Set<string>(SECTIONS);
export const TABS: readonly Tab[] = ["Overview", "Policies", "Usage"];
export const RANGES: readonly Range[] = ["Daily", "Weekly", "Monthly"];

export const ACCOUNTS = [
  {
    emoji: "😀",
    name: "Trading Account",
    address: "0x861780…859174",
    status: "Active",
    created: "10 Sept 2026",
  },
  {
    emoji: "🏦",
    name: "Treasury",
    address: "0x4b02c1…7fa093",
    status: "Active",
    created: "8 Sept 2026",
  },
] as const;

export const CHAIN_LABEL = { ethereum: "Ethereum", base: "Base" } as const;

export const EXECUTIONS = [
  {
    wallet: "Trading Account",
    emoji: "😀",
    chain: "ethereum" as const,
    key: "Uniswap Agent",
    caller: "uniswap-agent",
    tx: "0x7c31…a904",
    status: "Allowed",
    when: "2m ago",
  },
  {
    wallet: "Trading Account",
    emoji: "😀",
    chain: "ethereum" as const,
    key: "Uniswap Agent",
    caller: "uniswap-agent",
    tx: "Not signed",
    status: "Blocked",
    when: "5m ago",
  },
  {
    wallet: "Trading Account",
    emoji: "😀",
    chain: "ethereum" as const,
    key: "Uniswap Agent",
    caller: "uniswap-agent",
    tx: "0x2fa8…11c7",
    status: "Allowed",
    when: "18m ago",
  },
  {
    wallet: "Treasury",
    emoji: "🏦",
    chain: "base" as const,
    key: "Payouts Agent",
    caller: "payouts-worker",
    tx: "0x9de4…5b20",
    status: "Allowed",
    when: "1h ago",
  },
  {
    wallet: "Treasury",
    emoji: "🏦",
    chain: "base" as const,
    key: "Payouts Agent",
    caller: "payouts-worker",
    tx: "Not signed",
    status: "Blocked",
    when: "5h ago",
  },
] as const;

export const KEY_USAGE = [
  { what: "Swap 40 USDC for ETH", amount: "40 USDC", status: "Allowed", when: "2m ago" },
  { what: "Swap 120 USDC for ETH", amount: "120 USDC", status: "Blocked", when: "5m ago" },
  { what: "Approve USDC spend", amount: "-", status: "Allowed", when: "18m ago" },
  { what: "Swap 12 USDC for ETH", amount: "12 USDC", status: "Allowed", when: "3h ago" },
] as const;

export const INBOX = [
  {
    id: "blocked",
    icon: Key01Icon,
    title: "Session key stopped at its cap",
    preview: "A 120 USDC swap would have taken the period past 100…",
    when: "5m",
    heading: "Session key stopped at its cap",
    at: "10 September 2026 at 03:38",
    body: "Uniswap Agent asked to swap 120 USDC for ETH. It had spent 62 of the 100 USDC it is allowed this period, so the transaction was refused before it was signed. Nothing reached the network and no gas was spent.",
    facts: [
      ["Session key", "Uniswap Agent"],
      ["Spent", "62 of 100 USDC"],
      ["Refused", "120 USDC swap"],
    ],
    action: "Review policies",
  },
  {
    id: "cli",
    icon: ComputerTerminal01Icon,
    title: "CLI access approved",
    preview: "A CLI device can now use the selected session…",
    when: "4m",
    heading: "CLI access approved",
    at: "10 September 2026 at 03:38",
    body: "Namera CLI on darwin can now act through the session keys approved during authorization.",
    facts: [
      ["Device", "Namera CLI on darwin"],
      ["Session keys", "1"],
      ["Authorization ID", "01a08836-cfb1-77c8-849f"],
    ],
    action: "Manage CLI access",
  },
  {
    id: "key",
    icon: ApiIcon,
    title: "Session key created",
    preview: "A new policy-bound session key can access…",
    when: "8m",
    heading: "Session key created",
    at: "10 September 2026 at 03:30",
    body: "Payouts Agent was issued against Treasury and scoped to transfers of at most 5 USDC on Base. It cannot swap, cannot approve spend, and cannot touch any other account.",
    facts: [
      ["Account", "Treasury"],
      ["Limit", "5 USDC per transfer"],
      ["Networks", "Base"],
    ],
    action: "Open session key",
  },
  {
    id: "account",
    icon: SafeIcon,
    title: "Account created",
    preview: "Your smart account is ready to use.",
    when: "16m",
    heading: "Account created",
    at: "10 September 2026 at 03:22",
    body: "Trading Account is a programmable smart account owned by your passkey. Agents never hold its owner key; they are given session keys scoped to what you allow.",
    facts: [
      ["Implementation", "Alchemy Modular V2"],
      ["Ownership", "User-owned passkey"],
      ["Namespace", "EVM"],
    ],
    action: "Open account",
  },
  {
    id: "signin",
    icon: Login03Icon,
    title: "New sign-in detected",
    preview: "A new browser session signed in to your ac…",
    when: "18m",
    heading: "New sign-in detected",
    at: "10 September 2026 at 03:20",
    body: "Chrome on Mac OS signed in to your account. If this was not you, revoke the session and rotate your keys.",
    facts: [
      ["Device", "Chrome on Mac OS"],
      ["Status", "Current session"],
      ["Signed in", "10 Sept 2026"],
    ],
    action: "Review sessions",
  },
] as const;

/* Illustrative activity counts, not cumulative totals: busy periods alternate with quieter ones. */
export const SERIES: Record<Range, readonly number[]> = {
  Daily: [16, 21, 19, 10, 12, 27, 32, 24, 17, 19, 29, 23, 15, 20],
  Weekly: [42, 57, 63, 46, 31, 38, 55, 72, 61, 49, 34, 45, 59, 52],
  Monthly: [96, 118, 105, 78, 92, 143, 128, 110, 82, 97, 136, 154, 121, 132],
};
export const AXIS = ["27 Aug", "30 Aug", "2 Sept", "5 Sept", "8 Sept"];
