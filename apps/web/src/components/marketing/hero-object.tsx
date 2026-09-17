import { useId, useState } from "react";

import {
  AlchemyIcon,
  ApiIcon,
  ChainIcon,
  CheckmarkCircle02Icon,
  ComputerTerminal01Icon,
  Copy01Icon,
  DashboardSquare01Icon,
  Icon,
  InboxIcon,
  Key01Icon,
  Login03Icon,
  MoreHorizontalIcon,
  NameraIcon,
  PanelLeftIcon,
  PencilEdit02Icon,
  PlusSignIcon,
  PreferenceHorizontalIcon,
  SafeIcon,
  Search01Icon,
  Settings02Icon,
  Shield01Icon,
  SignatureIcon,
  TaskDone01Icon,
} from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

/* -------------------------------------------------------------------------
 * The hero object: the real dashboard, explorable.
 *
 * Redrawn from screenshots of the shipped product, screen by screen: the
 * grouped sidebar, the toolbar with its filter field and two icon buttons,
 * the tables with ruled header cells, the stat cards with their active
 * pills and sparklines, and the inbox with an icon tile per event.
 *
 * Five destinations work — Overview, Inbox, Accounts, Session Keys and
 * Activity. Settings is drawn like the rest and does nothing, because a
 * landing page has no business opening it.
 * ---------------------------------------------------------------------- */

type Section = "Overview" | "Inbox" | "Accounts" | "Session Keys" | "Activity";
type Tab = "Overview" | "Policies" | "Usage";
type Range = "Daily" | "Weekly" | "Monthly";

const NAV = [
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

const SECTIONS: readonly Section[] = ["Overview", "Inbox", "Accounts", "Session Keys", "Activity"];
const SWITCHABLE = new Set<string>(SECTIONS);
const TABS: readonly Tab[] = ["Overview", "Policies", "Usage"];
const RANGES: readonly Range[] = ["Daily", "Weekly", "Monthly"];

const ACCOUNTS = [
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

const CHAIN_LABEL = { ethereum: "Ethereum", base: "Base" } as const;

const EXECUTIONS = [
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

const KEY_USAGE = [
  { what: "Swap 40 USDC for ETH", amount: "40 USDC", status: "Allowed", when: "2m ago" },
  { what: "Swap 120 USDC for ETH", amount: "120 USDC", status: "Blocked", when: "5m ago" },
  { what: "Approve USDC spend", amount: "—", status: "Allowed", when: "18m ago" },
  { what: "Swap 12 USDC for ETH", amount: "12 USDC", status: "Allowed", when: "3h ago" },
] as const;

const INBOX = [
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

/* Points for the operations chart, one series per range. */
const SERIES: Record<Range, readonly number[]> = {
  Daily: [4, 9, 6, 14, 11, 19, 16, 24, 21, 28, 26, 34, 31, 38],
  Weekly: [18, 26, 21, 34, 29, 41, 36, 48, 44, 57, 52, 64, 61, 72],
  Monthly: [40, 62, 55, 78, 71, 96, 88, 112, 104, 131, 124, 148, 141, 168],
};
const AXIS = ["27 Aug", "30 Aug", "2 Sept", "5 Sept", "8 Sept"];

/* ---------------------------------- parts ---------------------------------- */

const IconChip = ({ icon }: { readonly icon: typeof Search01Icon }) => (
  <span
    aria-hidden
    className="grid size-7 shrink-0 place-items-center rounded-full border-1 border-border bg-surface/60 text-ink-subtle"
  >
    <Icon icon={icon} strokeWidth={1.7} className="size-3.5" />
  </span>
);

/** The filter field and its two buttons, as every list screen has them. */
const Toolbar = ({ placeholder }: { readonly placeholder: string }) => (
  <div className="flex items-center gap-2">
    <div
      aria-hidden
      className="flex h-8 w-full max-w-[19rem] items-center gap-2 rounded-lg border-1 border-border bg-surface/50 px-2.5"
    >
      <Icon icon={Search01Icon} strokeWidth={1.7} className="size-3.5 text-ink-subtle" />
      <span className="truncate text-[0.75rem] text-ink-subtle">{placeholder}</span>
    </div>
    <span className="ml-auto flex items-center gap-2">
      <IconChip icon={PreferenceHorizontalIcon} />
      <IconChip icon={PanelLeftIcon} />
    </span>
  </div>
);

type Column = { readonly label: string; readonly className?: string };

const Table = ({
  columns,
  children,
}: {
  readonly columns: readonly Column[];
  readonly children: React.ReactNode;
}) => (
  <table className="w-full table-fixed border-collapse text-left">
    <thead>
      <tr className="border-y-1 border-border">
        {columns.map((column) => (
          <th
            key={column.label}
            scope="col"
            className={cn(
              "truncate border-l-1 border-border px-3 py-2 text-[0.6875rem] font-normal text-ink-subtle first:border-l-0",
              column.className,
            )}
          >
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
);

const Td = ({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) => (
  <td
    className={cn(
      "truncate border-b-1 border-border px-3 py-3 text-[0.8125rem] text-foreground",
      className,
    )}
  >
    {children}
  </td>
);

const StatusCell = ({ status }: { readonly status: string }) => {
  const blocked = status === "Blocked";
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[0.8125rem]",
        blocked ? "text-danger" : "text-success",
      )}
    >
      <Icon
        icon={blocked ? MoreHorizontalIcon : CheckmarkCircle02Icon}
        aria-hidden
        strokeWidth={1.8}
        className={cn("size-3.5", blocked && "hidden")}
      />
      {blocked ? <span aria-hidden className="size-1.5 rounded-full bg-danger" /> : null}
      {status}
    </span>
  );
};

const Emoji = ({ children }: { readonly children: React.ReactNode }) => (
  <span
    aria-hidden
    className="grid size-5 shrink-0 place-items-center rounded-md bg-default/70 text-[0.6875rem]"
  >
    {children}
  </span>
);

const Meter = ({
  label,
  used,
  of,
  fill,
}: {
  readonly label: string;
  readonly used: string;
  readonly of: string;
  readonly fill: number;
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[0.75rem] text-ink-subtle">{label}</span>
      <span className="text-[0.75rem] tabular-nums text-foreground">
        {used}
        <span className="text-ink-subtle"> of {of}</span>
      </span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-default">
      <div className="h-full rounded-full bg-accent" style={{ width: `${String(fill)}%` }} />
    </div>
  </div>
);

const Row = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) => (
  <div className="flex items-start gap-4 border-t-1 border-border py-2.5">
    <dt className="w-28 shrink-0 text-[0.75rem] text-ink-subtle">{label}</dt>
    <dd className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-foreground">{children}</dd>
  </div>
);

/* --------------------------------- overview -------------------------------- */

const Sparkline = ({ up }: { readonly up: boolean }) => (
  <svg viewBox="0 0 120 24" aria-hidden className="h-5 w-24 shrink-0 overflow-visible">
    <path
      d={
        up ? "M0 20 L28 17 L52 12 L78 13 L100 6 L120 3" : "M0 8 L26 10 L50 7 L76 14 L102 12 L120 18"
      }
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StatCard = ({
  icon,
  label,
  value,
  pill,
  delta,
  up,
}: {
  readonly icon: typeof Key01Icon;
  readonly label: string;
  readonly value: string;
  readonly pill?: string;
  readonly delta?: string;
  readonly up?: boolean;
}) => (
  <div className="rounded-xl border-1 border-border bg-surface/40 px-3.5 py-3">
    <p className="flex items-center gap-2 text-[0.8125rem] text-foreground">
      <Icon icon={icon} aria-hidden strokeWidth={1.7} className="size-3.5 text-ink-subtle" />
      <span className="truncate">{label}</span>
    </p>
    <div className="mt-2 flex items-end justify-between gap-2">
      <span className="text-[1.5rem] leading-none tracking-[-0.02em] tabular-nums text-foreground">
        {value}
      </span>
      {pill ? (
        <span className="rounded-md bg-success/12 px-1.5 py-0.5 text-[0.625rem] text-success">
          {pill}
        </span>
      ) : null}
    </div>
    {delta ? (
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="shrink-0 text-[0.6875rem] text-ink-subtle">
          <span className="text-muted">{delta}</span> last 7d
        </span>
        <span className="text-accent">
          <Sparkline up={up ?? true} />
        </span>
      </div>
    ) : null}
  </div>
);

const OperationsChart = ({ range }: { readonly range: Range }) => {
  const points = SERIES[range];
  const max = Math.max(...points);
  const step = 100 / (points.length - 1);
  const line = points
    .map((p, i) => `${String(i * step)},${String(100 - (p / max) * 88)}`)
    .join(" L");

  return (
    <div className="relative mt-4 h-[9.5rem]">
      <div className="absolute inset-0 flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="border-t-1 border-dashed border-border/70" />
        ))}
      </div>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
        className="absolute inset-0 size-full"
      >
        <defs>
          <linearGradient id="ops-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5e6ad2" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#5e6ad2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M${line} L100,100 L0,100 Z`} fill="url(#ops-fill)" />
        <path
          d={`M${line}`}
          fill="none"
          stroke="#7d87e8"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const HomePanel = () => {
  const [range, setRange] = useState<Range>("Daily");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatCard icon={SafeIcon} label="Accounts" value="2" pill="2 active" />
        <StatCard icon={Key01Icon} label="Session keys" value="3" pill="3 active" />
        <StatCard icon={TaskDone01Icon} label="Executions" value="148" delta="+12%" up />
        <StatCard icon={SignatureIcon} label="Signatures" value="1,204" delta="+4%" up />
      </div>

      <div className="hidden gap-2 lg:grid lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="rounded-xl border-1 border-border bg-surface/40 px-4 py-3.5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-medium text-foreground">Operations activity</p>
              <p className="mt-0.5 truncate text-[0.6875rem] text-ink-subtle">
                Confirmed executions and signatures over time
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {RANGES.map((item) => {
                const active = item === range;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setRange(item);
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[0.6875rem]",
                      "transition-colors duration-150 ease-out-quad",
                      "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus/60",
                      active ? "bg-accent text-white" : "text-ink-subtle hover:text-muted",
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <OperationsChart range={range} />

          <div className="mt-2 flex justify-between text-[0.625rem] text-ink-subtle">
            {AXIS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-1 border-border bg-surface/40 px-4 py-3.5">
          <p className="text-[0.8125rem] font-medium text-foreground">Execution sources</p>
          <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">
            Where confirmed executions originate
          </p>
          <div className="mt-5 flex flex-col gap-4">
            <Meter label="Uniswap Agent" used="94" of="148" fill={64} />
            <Meter label="Payouts Agent" used="54" of="148" fill={36} />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[0.9375rem] font-medium tracking-[-0.01em] text-foreground">
            Recent activity
          </h2>
          <span className="text-[0.6875rem] text-ink-subtle">View all</span>
        </div>
        <div className="mt-2">
          <Table
            columns={[
              { label: "Wallet" },
              { label: "Chain", className: "hidden sm:table-cell w-[7rem]" },
              { label: "Session key", className: "hidden lg:table-cell" },
              { label: "Transaction", className: "hidden xl:table-cell" },
              { label: "Status", className: "w-[7rem]" },
              { label: "Executed", className: "w-[6.5rem]" },
            ]}
          >
            {EXECUTIONS.slice(0, 3).map((item) => (
              <tr key={item.tx + item.when}>
                <Td>
                  <span className="flex items-center gap-2">
                    <Emoji>{item.emoji}</Emoji>
                    <span className="truncate">{item.wallet}</span>
                  </span>
                </Td>
                <Td className="hidden sm:table-cell">
                  <span className="flex items-center gap-1.5">
                    <ChainIcon
                      namespace="eip155"
                      chain={item.chain}
                      aria-hidden
                      className="size-3.5 rounded-[3px]"
                    />
                    {CHAIN_LABEL[item.chain]}
                  </span>
                </Td>
                <Td className="hidden text-muted lg:table-cell">{item.key}</Td>
                <Td className="type-mono hidden text-[0.6875rem] text-muted xl:table-cell">
                  {item.tx}
                </Td>
                <Td>
                  <StatusCell status={item.status} />
                </Td>
                <Td className="text-[0.75rem] text-ink-subtle">{item.when}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </div>
  );
};

/* ---------------------------------- inbox ---------------------------------- */

const InboxPanel = () => {
  const [openId, setOpenId] = useState<string>(INBOX[0].id);
  const open = INBOX.find((item) => item.id === openId) ?? INBOX[0];

  return (
    <div className="-mx-4 -mt-3 flex h-full sm:-mx-6">
      <div className="w-full shrink-0 border-border px-3 lg:w-[18rem] lg:border-r-1">
        <div
          aria-hidden
          className="mt-1 flex h-8 items-center gap-2 rounded-lg border-1 border-border bg-surface/50 px-2.5"
        >
          <Icon icon={Search01Icon} strokeWidth={1.7} className="size-3.5 text-ink-subtle" />
          <span className="text-[0.75rem] text-ink-subtle">Search inbox…</span>
        </div>

        <ul className="mt-2 flex flex-col">
          {INBOX.map((item) => {
            const active = item.id === open.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(item.id);
                  }}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left",
                    "transition-colors duration-150 ease-out-quad",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus/60",
                    active ? "bg-default/60" : "hover:bg-default/30",
                  )}
                >
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-default/70 text-ink-subtle"
                  >
                    <Icon icon={item.icon} strokeWidth={1.7} className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[0.625rem] text-ink-subtle">{item.when}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-subtle">
                      {item.preview}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="hidden min-w-0 flex-1 px-8 pt-4 lg:block">
        <div className="mx-auto max-w-[32rem]">
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-default/70 text-muted"
            >
              <Icon icon={open.icon} strokeWidth={1.6} className="size-4.5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[1.125rem] font-medium tracking-[-0.015em] text-foreground">
                {open.heading}
              </h2>
              <p className="mt-1 text-[0.6875rem] text-ink-subtle">{open.at}</p>
            </div>
          </div>

          <p className="mt-6 text-[0.8125rem] leading-relaxed text-muted">{open.body}</p>

          <dl className="mt-6 overflow-hidden rounded-xl border-1 border-border bg-surface/40">
            {open.facts.map(([label, value], index) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-4 px-4 py-3",
                  index > 0 && "border-t-1 border-border",
                )}
              >
                <dt className="w-32 shrink-0 text-[0.75rem] text-ink-subtle">{label}</dt>
                <dd className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-foreground">
                  <span className="truncate">{value}</span>
                  {label.endsWith("ID") ? (
                    <Icon
                      icon={Copy01Icon}
                      aria-hidden
                      strokeWidth={1.7}
                      className="size-3.5 shrink-0 text-ink-subtle"
                    />
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          <span className="mt-5 inline-flex items-center rounded-lg border-1 border-border bg-default/60 px-3 py-1.5 text-[0.75rem] text-foreground">
            {open.action}
          </span>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------- key screen ------------------------------- */

const KeyHeader = () => (
  <div className="flex items-start gap-3 pr-10">
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#3a2a52] text-[1rem]"
    >
      🦄
    </span>
    <div className="min-w-0 pt-0.5">
      <h2 className="text-[1.125rem] font-medium tracking-[-0.015em] text-foreground">
        Uniswap Agent
      </h2>
      <p className="mt-1 text-[0.75rem] text-ink-subtle">
        Session key which has allowance to spend maximum of $100 USDC
      </p>
    </div>
  </div>
);

const OverviewPanel = () => (
  <>
    <KeyHeader />
    <p className="mt-7 text-[0.75rem] text-ink-subtle">Properties</p>
    <dl className="mt-2 flex flex-col">
      <Row label="Status">
        <Icon
          icon={CheckmarkCircle02Icon}
          aria-hidden
          strokeWidth={1.8}
          className="size-3.5 text-success"
        />
        Active
      </Row>
      <Row label="Account">
        <Emoji>😀</Emoji> Trading Account
      </Row>
      <Row label="Namespace">
        <ChainIcon
          namespace="eip155"
          chain="ethereum"
          aria-hidden
          className="size-3.5 rounded-[3px]"
        />
        EVM
      </Row>
      <Row label="Session key ID">
        <span className="type-mono truncate text-[0.6875rem] text-muted">
          01a08832-f20e-7618-83ac
        </span>
      </Row>
      <Row label="Created">10 Sept 2026</Row>
    </dl>
  </>
);

const PoliciesPanel = () => (
  <>
    <KeyHeader />
    <p className="mt-7 text-[0.75rem] text-ink-subtle">Networks and lifetime</p>
    <dl className="mt-2 flex flex-col">
      <Row label="Networks">
        <ChainIcon
          namespace="eip155"
          chain="ethereum"
          aria-hidden
          className="size-3.5 rounded-[3px]"
        />
        Ethereum
      </Row>
      <Row label="Expires at">27 Sept 2026</Row>
      <Row label="Signatures">
        <span className="text-muted">Messages and typed data allowed</span>
      </Row>
    </dl>

    <p className="mt-7 text-[0.75rem] text-ink-subtle">Onchain permissions</p>
    <div className="mt-2 rounded-lg border-1 border-border bg-surface/50 px-3.5 py-3">
      <p className="text-[0.8125rem] font-medium text-foreground">Token spend limit</p>
      <p className="type-mono mt-1 truncate text-[0.6875rem] text-ink-subtle">
        0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
      </p>
      <p className="mt-1.5 text-[0.75rem] text-muted">100 USDC per network</p>
    </div>
  </>
);

const UsagePanel = () => (
  <>
    <KeyHeader />

    <div className="mt-7 grid gap-4 sm:grid-cols-2">
      <Meter label="Token spend" used="62 USDC" of="100 USDC" fill={62} />
      <Meter label="Gas" used="0.004 ETH" of="0.05 ETH" fill={8} />
    </div>

    <p className="mt-7 text-[0.75rem] text-ink-subtle">Executions</p>
    <div className="mt-2">
      <Table
        columns={[
          { label: "Operation" },
          { label: "Amount", className: "hidden sm:table-cell w-[7rem]" },
          { label: "Status", className: "w-[7rem]" },
          { label: "Executed", className: "hidden sm:table-cell w-[6.5rem]" },
        ]}
      >
        {KEY_USAGE.map((item) => (
          <tr key={item.what}>
            <Td>{item.what}</Td>
            <Td className="hidden tabular-nums text-muted sm:table-cell">{item.amount}</Td>
            <Td>
              <StatusCell status={item.status} />
            </Td>
            <Td className="hidden text-[0.75rem] text-ink-subtle sm:table-cell">{item.when}</Td>
          </tr>
        ))}
      </Table>
    </div>
    <p className="mt-3 text-[0.6875rem] text-ink-subtle">
      120 USDC was refused: it would have taken the period past 100.
    </p>
  </>
);

/* ------------------------------- list screens ------------------------------ */

const AccountsPanel = () => (
  <div className="flex flex-col gap-4">
    <Toolbar placeholder="Filter accounts…" />
    <Table
      columns={[
        { label: "Name" },
        { label: "Namespace", className: "hidden sm:table-cell w-[7.5rem]" },
        { label: "Address", className: "hidden lg:table-cell" },
        { label: "Implementation", className: "hidden xl:table-cell" },
        { label: "Status", className: "w-[7rem]" },
        { label: "Created", className: "hidden sm:table-cell w-[7rem]" },
      ]}
    >
      {ACCOUNTS.map((account) => (
        <tr key={account.name}>
          <Td>
            <span className="flex items-center gap-2">
              <Emoji>{account.emoji}</Emoji>
              <span className="truncate">{account.name}</span>
            </span>
          </Td>
          <Td className="hidden sm:table-cell">
            <span className="flex items-center gap-1.5">
              <ChainIcon
                namespace="eip155"
                chain="ethereum"
                aria-hidden
                className="size-3.5 rounded-[3px]"
              />
              EVM
            </span>
          </Td>
          <Td className="type-mono hidden text-[0.6875rem] text-muted lg:table-cell">
            {account.address}
          </Td>
          <Td className="hidden xl:table-cell">
            <span className="flex items-center gap-1.5">
              <AlchemyIcon aria-hidden className="size-3.5 rounded-[3px]" />
              <span className="truncate">Alchemy Modular V2</span>
            </span>
          </Td>
          <Td>
            <StatusCell status={account.status} />
          </Td>
          <Td className="hidden text-[0.75rem] text-ink-subtle sm:table-cell">{account.created}</Td>
        </tr>
      ))}
    </Table>
  </div>
);

const ActivityPanel = () => (
  <div className="flex flex-col gap-4">
    <Toolbar placeholder="Filter executions…" />
    <Table
      columns={[
        { label: "Wallet" },
        { label: "Chain", className: "hidden sm:table-cell w-[7rem]" },
        { label: "Session key", className: "hidden lg:table-cell" },
        { label: "Called by", className: "hidden xl:table-cell" },
        { label: "Transaction", className: "hidden lg:table-cell w-[8rem]" },
        { label: "Status", className: "w-[7rem]" },
        { label: "Executed", className: "w-[6.5rem]" },
      ]}
    >
      {EXECUTIONS.map((item, index) => (
        <tr key={`${item.tx}-${String(index)}`}>
          <Td>
            <span className="flex items-center gap-2">
              <Emoji>{item.emoji}</Emoji>
              <span className="truncate">{item.wallet}</span>
            </span>
          </Td>
          <Td className="hidden sm:table-cell">
            <span className="flex items-center gap-1.5">
              <ChainIcon
                namespace="eip155"
                chain={item.chain}
                aria-hidden
                className="size-3.5 rounded-[3px]"
              />
              {CHAIN_LABEL[item.chain]}
            </span>
          </Td>
          <Td className="hidden text-muted lg:table-cell">{item.key}</Td>
          <Td className="type-mono hidden text-[0.6875rem] text-muted xl:table-cell">
            {item.caller}
          </Td>
          <Td className="type-mono hidden text-[0.6875rem] text-muted lg:table-cell">{item.tx}</Td>
          <Td>
            <StatusCell status={item.status} />
          </Td>
          <Td className="text-[0.75rem] text-ink-subtle">{item.when}</Td>
        </tr>
      ))}
    </Table>
  </div>
);

/* --------------------------------- object --------------------------------- */

export const HeroObject = () => {
  const [section, setSection] = useState<Section>("Overview");
  const [tab, setTab] = useState<Tab>("Policies");
  const tabsId = useId();

  const breadcrumb = section === "Session Keys" ? ["Session Keys", "Uniswap Agent"] : [section];

  return (
    <div
      className={cn(
        "edge-top relative flex overflow-hidden rounded-xl border-1 border-hairline-strong",
        "h-auto sm:h-[35rem] lg:h-[40rem]",
        "bg-[linear-gradient(168deg,#141518_0%,#101113_44%,#0c0d0f_100%)]",
      )}
    >
      {/* Sidebar */}
      <nav
        aria-label="Namera dashboard preview"
        className="hidden w-[176px] shrink-0 flex-col gap-4 p-3 md:flex lg:w-[200px]"
      >
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            aria-hidden
            className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-default/80"
          >
            <NameraIcon fill="currentColor" className="h-1.5 w-auto text-foreground" />
          </span>
          <span className="text-[0.75rem] font-medium text-foreground">Personal</span>
          <svg viewBox="0 0 12 12" className="size-3 text-ink-subtle" aria-hidden>
            <path
              d="M3 4.5 6 7.5 9 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="ml-auto flex items-center gap-1.5 text-ink-subtle">
            <Icon icon={Search01Icon} aria-hidden strokeWidth={1.7} className="size-3.5" />
            <Icon icon={PencilEdit02Icon} aria-hidden strokeWidth={1.7} className="size-3.5" />
          </span>
        </div>

        {NAV.map((group) => (
          <div key={group.group} className="flex flex-col gap-0.5">
            <p className="px-2 pb-1 text-[0.625rem] font-medium text-ink-subtle">{group.group}</p>
            {group.items.map((item) => {
              const selectable = SWITCHABLE.has(item.label);
              const active = selectable && item.label === section;
              return (
                <button
                  key={item.label}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (selectable) setSection(item.label as Section);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.75rem]",
                    "transition-colors duration-150 ease-out-quad",
                    "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus/60",
                    selectable ? "cursor-pointer" : "cursor-default",
                    active ? "bg-default/80 text-foreground" : "text-ink-subtle",
                    !active && selectable && "hover:bg-default/40 hover:text-muted",
                  )}
                >
                  <Icon
                    icon={item.icon}
                    aria-hidden
                    strokeWidth={1.7}
                    className="size-3.5 shrink-0"
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Panel */}
      <div className="flex min-w-0 flex-1 flex-col border-l-1 border-border bg-canvas/40 md:m-2 md:ml-0 md:rounded-lg md:border-1">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b-1 border-border px-4 text-[0.75rem]">
          <Icon
            icon={PanelLeftIcon}
            aria-hidden
            strokeWidth={1.7}
            className="mr-1 size-3.5 shrink-0 text-ink-subtle"
          />
          {breadcrumb.map((crumb, index) => (
            <span key={crumb} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden className="text-separator">
                  /
                </span>
              ) : null}
              <span
                className={index === breadcrumb.length - 1 ? "text-foreground" : "text-ink-subtle"}
              >
                {crumb}
              </span>
            </span>
          ))}
          {section === "Inbox" ? (
            <span className="ml-3 flex items-center gap-2">
              <IconChip icon={PreferenceHorizontalIcon} />
              <IconChip icon={CheckmarkCircle02Icon} />
            </span>
          ) : null}
          <span
            aria-hidden
            className="ml-auto grid size-6 place-items-center rounded-md text-ink-subtle"
          >
            <Icon
              icon={section === "Accounts" ? PlusSignIcon : MoreHorizontalIcon}
              strokeWidth={2}
              className="size-3.5"
            />
          </span>
        </div>

        {/* The sidebar is hidden on a phone, so the sections move to a rail. */}
        <div
          className={cn(
            "flex shrink-0 gap-1 overflow-x-auto border-b-1 border-border px-3 py-2 md:hidden",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {SECTIONS.map((item) => {
            const active = item === section;
            return (
              <button
                key={item}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  setSection(item);
                }}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-[0.75rem] whitespace-nowrap",
                  "transition-colors duration-150 ease-out-quad",
                  "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus/60",
                  active ? "bg-default/80 text-foreground" : "text-ink-subtle",
                )}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden px-4 pt-3 pb-5 sm:px-6">
          {section === "Session Keys" ? (
            <div className="flex">
              <div className="min-w-0 flex-1">
                <div role="tablist" aria-label="Session key" className="flex items-center gap-1">
                  {TABS.map((item) => {
                    const active = item === tab;
                    return (
                      <button
                        key={item}
                        type="button"
                        role="tab"
                        id={`${tabsId}-${item}`}
                        aria-selected={active}
                        aria-controls={`${tabsId}-panel`}
                        onClick={() => {
                          setTab(item);
                        }}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 text-[0.75rem]",
                          "transition-colors duration-150 ease-out-quad",
                          "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus/60",
                          active
                            ? "bg-default/80 text-foreground"
                            : "text-ink-subtle hover:text-muted",
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>

                <div
                  id={`${tabsId}-panel`}
                  role="tabpanel"
                  aria-labelledby={`${tabsId}-${tab}`}
                  className={cn("mt-6", tab === "Usage" ? "max-w-none" : "max-w-[30rem]")}
                >
                  {tab === "Overview" ? <OverviewPanel /> : null}
                  {tab === "Policies" ? <PoliciesPanel /> : null}
                  {tab === "Usage" ? <UsagePanel /> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className={section === "Inbox" ? "h-full" : "mt-3"}>
              {section === "Overview" ? <HomePanel /> : null}
              {section === "Inbox" ? <InboxPanel /> : null}
              {section === "Accounts" ? <AccountsPanel /> : null}
              {section === "Activity" ? <ActivityPanel /> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
