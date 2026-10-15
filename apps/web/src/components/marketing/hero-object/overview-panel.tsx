import { useState } from "react";

import {
  ChainIcon,
  Icon,
  Key01Icon,
  SafeIcon,
  SignatureIcon,
  TaskDone01Icon,
} from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { AXIS, CHAIN_LABEL, EXECUTIONS, RANGES, SERIES, type Range } from "./data";
import { Emoji, Meter, StatusCell, Table, Td } from "./display";

const Sparkline = ({ up }: { readonly up: boolean }) => (
  <svg viewBox="0 0 120 24" aria-hidden className="h-5 w-24 max-w-full">
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
  <div className="flex flex-col rounded-xl border-1 border-border bg-surface/40 px-3.5 py-3">
    <p className="flex items-center gap-2 text-[0.8125rem] text-foreground">
      <Icon icon={icon} aria-hidden strokeWidth={1.7} className="size-3.5 text-ink-subtle" />
      <span className="truncate">{label}</span>
    </p>
    <div className={cn("flex items-end justify-between gap-2", pill ? "mt-auto pt-5" : "mt-2")}>
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
        <span className="flex min-w-0 flex-1 justify-end text-accent">
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
  const coordinates = points.map((value, index) => ({
    x: index * step,
    y: 100 - (value / max) * 88,
  }));
  // Horizontal tangents round the turns without overshooting the sample values.
  const line = coordinates
    .map((point, index) => {
      const previous = coordinates[index - 1];
      if (!previous) return `M${point.x},${point.y}`;
      const midpoint = (previous.x + point.x) / 2;
      return `C${midpoint},${previous.y} ${midpoint},${point.y} ${point.x},${point.y}`;
    })
    .join(" ");

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
        <path d={`${line} L100,100 L0,100 Z`} fill="url(#ops-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#7d87e8"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const HomePanel = () => {
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
