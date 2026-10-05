import type React from "react";

import {
  AlchemyIcon,
  Blockchain01Icon,
  CancelCircleIcon,
  ChainIcon,
  Icon,
  Key01Icon,
  Loading03Icon,
  Package01Icon,
  PreferenceHorizontalIcon,
  SignatureIcon,
  Tick02Icon,
  TokenIcon,
} from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import {
  CHAINS,
  POLICY_CHECKS,
  PREPARE_STEPS,
  ROUTES,
  SOURCES,
  type CardState,
  type Cell,
  type ChainId,
  type RouteId,
  type SourceId,
} from "./model";

/*
 * Every card is the same object: a header that names the step, then property
 * rows, label left and value right, separated by hairlines. That is the shape
 * the product's own detail screens use (DESIGN.md, "The hero surface"), so the
 * canvas reads as the product rather than as a diagram about it.
 *
 * Colour carries one meaning each. Accent marks progress and is the only hue
 * on the wiring. Green appears once, on the confirmation, and red once, on a
 * refusal: the two places the product reports a real allow or block.
 */

const shell = (state: CardState) =>
  cn(
    "edge-top flex size-full flex-col overflow-hidden rounded-xl border-1 bg-surface",
    "transition-colors duration-300 ease-out-quad",
    state === "failed"
      ? "border-danger/45"
      : state === "active"
        ? "border-accent/50"
        : state === "done"
          ? "border-accent/25"
          : "border-border",
  );

const Badge = ({ children }: { readonly children: React.ReactNode }) => (
  <span className="shrink-0 rounded-md border-1 border-border px-1.5 py-0.5 text-[0.625rem] text-ink-subtle">
    {children}
  </span>
);

type HeadProps = {
  readonly title: string;
  readonly note: string;
  readonly state: CardState;
  readonly renderMark?: (props: { readonly className: string }) => React.ReactNode;
  readonly brand?: React.ReactNode;
  readonly badge?: React.ReactNode;
};

const Head = ({ title, note, state, renderMark, brand, badge }: HeadProps) => (
  <div className="flex items-center gap-2.5 border-b-1 border-border px-3 py-2.5">
    {brand === undefined ? (
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg border-1",
          "transition-colors duration-300 ease-out-quad",
          state === "failed"
            ? "border-danger/35 bg-danger/8"
            : state === "active"
              ? "border-accent/40 bg-accent/10"
              : "border-hairline-strong bg-default/40",
        )}
      >
        {renderMark?.({
          className:
            cn(
              "size-[1.0625rem]",
              state === "failed"
                ? "text-danger"
                : state === "active"
                  ? "text-accent-text"
                  : state === "done"
                    ? "text-foreground"
                    : "text-ink-subtle",
            ) ?? "",
        })}
      </span>
    ) : (
      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg">
        {brand}
      </span>
    )}
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[0.8125rem] leading-tight text-foreground">{title}</span>
      <span className="block truncate text-[0.6875rem] leading-tight text-ink-subtle">{note}</span>
    </span>
    {badge ?? null}
  </div>
);

/** Marks whether a step has run, failed, or has not been reached. */
const Pip = ({ state }: { readonly state: Cell }) => {
  if (state === "active") {
    return (
      <Icon
        icon={Loading03Icon}
        aria-hidden
        strokeWidth={2}
        className="size-3.5 shrink-0 animate-spin text-accent-text"
      />
    );
  }
  if (state === "pass") {
    return (
      <Icon
        icon={Tick02Icon}
        aria-hidden
        strokeWidth={2.4}
        className="size-3.5 shrink-0 text-muted"
      />
    );
  }
  if (state === "fail") {
    return (
      <Icon
        icon={CancelCircleIcon}
        aria-hidden
        strokeWidth={2}
        className="size-3.5 shrink-0 text-danger"
      />
    );
  }
  return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-hairline-strong" />;
};

const Row = ({
  label,
  children,
  className,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}) => (
  <div
    className={cn(
      "flex flex-1 flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:gap-2 sm:py-[0.4375rem]",
      className,
    )}
  >
    <span className="shrink-0 text-[0.6875rem] text-ink-subtle sm:w-[3.25rem]">{label}</span>
    <span className="flex min-w-0 flex-1 items-center gap-1">{children}</span>
  </div>
);

const chip = (active: boolean) =>
  cn(
    "tap-halo nodrag nopan relative flex min-w-0 items-center justify-center gap-1 rounded-md border-1 px-1.5 py-1.5",
    "text-[0.6875rem] whitespace-nowrap transition-colors duration-150 ease-out-quad",
    "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus/60",
    active
      ? "border-hairline-strong bg-default/80 text-foreground"
      : "border-transparent text-ink-subtle hover:bg-default/40 hover:text-muted",
  );

/* ---- intent ------------------------------------------------------------- */

type IntentProps = {
  readonly source: SourceId;
  readonly route: RouteId;
  /** index into the route's amount chips */
  readonly amount: number;
  readonly chain: ChainId;
  readonly state: CardState;
  readonly onSource: (value: SourceId) => void;
  readonly onRoute: (value: RouteId) => void;
  readonly onAmount: (value: number) => void;
  readonly onChain: (value: ChainId) => void;
};

export const IntentCard = (props: IntentProps) => {
  const route = ROUTES.find((item) => item.id === props.route) ?? ROUTES[0];
  return (
    <div className={shell(props.state)}>
      <Head
        title="Intent"
        note="what the agent wants"
        state={props.state}
        renderMark={({ className }) => (
          <Icon
            icon={PreferenceHorizontalIcon}
            aria-hidden
            strokeWidth={1.7}
            className={className ?? ""}
          />
        )}
      />

      <div className="flex flex-1 flex-col divide-y-1 divide-border/70">
        <Row label="From">
          {SOURCES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === props.source}
              onClick={() => {
                props.onSource(item.id);
              }}
              className={cn(chip(item.id === props.source), "shrink-0")}
            >
              <item.Glyph className="size-3 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </Row>

        <Row label="Swap">
          {ROUTES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === props.route}
              onClick={() => {
                props.onRoute(item.id);
              }}
              className={cn(chip(item.id === props.route), "flex-1")}
            >
              <TokenIcon symbol={item.sell} aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </Row>

        <Row label="Amount">
          {route.amounts.map((value, index) => (
            <button
              key={value}
              type="button"
              aria-pressed={index === props.amount}
              onClick={() => {
                props.onAmount(index);
              }}
              className={cn(chip(index === props.amount), "flex-1")}
            >
              {value} {route.sell}
            </button>
          ))}
        </Row>

        <Row label="Chain">
          <span className="grid min-w-0 flex-1 grid-cols-2 gap-1">
            {CHAINS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === props.chain}
                onClick={() => {
                  props.onChain(item.id);
                }}
                className={chip(item.id === props.chain)}
              >
                <ChainIcon
                  namespace="eip155"
                  chain={item.id}
                  aria-hidden
                  className="size-3 shrink-0 rounded-[2px]"
                />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </span>
        </Row>
      </div>
    </div>
  );
};

/* ---- the request, once it has left the agent --------------------------- */

export const SourceCard = ({
  source,
  state,
}: {
  readonly source: SourceId;
  readonly state: CardState;
}) => {
  const item = SOURCES.find((entry) => entry.id === source) ?? SOURCES[0];
  return (
    <div className={shell(state)}>
      <Head
        title={item.label}
        note={item.note}
        state={state}
        renderMark={(props) => <item.Glyph {...props} />}
      />
    </div>
  );
};

export const SwapCard = ({
  state,
  sell,
  buy,
  amount,
  chain,
  chainLabel,
}: {
  readonly state: CardState;
  readonly sell: "USDC" | "ETH";
  readonly buy: string;
  readonly amount: string;
  readonly chain: ChainId;
  readonly chainLabel: string;
}) => (
  <div className={shell(state)}>
    <Head
      title="Swap"
      note="on Uniswap"
      state={state}
      brand={
        <span className="grid size-8 place-items-center rounded-lg border-1 border-hairline-strong bg-default/40">
          <TokenIcon symbol={sell} aria-hidden className="size-[1.0625rem]" />
        </span>
      }
    />
    <div className="flex flex-1 flex-col divide-y-1 divide-border/70">
      <div className="flex flex-1 items-center justify-between gap-2 px-3">
        <span className="text-[0.6875rem] text-ink-subtle">Sell</span>
        <span className="truncate text-[0.6875rem] text-foreground">
          {amount} {sell}
        </span>
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 px-3">
        <span className="text-[0.6875rem] text-ink-subtle">Buy</span>
        <span className="truncate text-[0.6875rem] text-foreground">{buy}</span>
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 px-3">
        <span className="text-[0.6875rem] text-ink-subtle">Chain</span>
        <span className="flex items-center gap-1.5 truncate text-[0.6875rem] text-foreground">
          <ChainIcon
            namespace="eip155"
            chain={chain}
            aria-hidden
            className="size-3 shrink-0 rounded-[2px]"
          />
          {chainLabel}
        </span>
      </div>
    </div>
  </div>
);

/* ---- prepare ------------------------------------------------------------ */

export const PrepareCard = ({
  state,
  cells,
}: {
  readonly state: CardState;
  readonly cells: readonly Cell[];
}) => (
  <div className={shell(state)}>
    <Head
      title="Prepare"
      note="getting the swap ready"
      state={state}
      brand={<AlchemyIcon aria-hidden className="size-8" />}
      badge={<Badge>sponsored</Badge>}
    />
    <div className="flex flex-1 flex-col divide-y-1 divide-border/70">
      {PREPARE_STEPS.map((item, index) => {
        const cell = cells[index] ?? "idle";
        return (
          <div key={item.label} className="flex flex-1 items-center gap-2.5 px-3 py-2">
            <Pip state={cell} />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-[0.75rem] leading-tight",
                  cell === "idle" ? "text-ink-subtle" : "text-foreground",
                )}
              >
                {item.label}
              </span>
              <span className="block truncate text-[0.625rem] leading-tight text-ink-subtle">
                {cell === "skipped" ? "not reached" : item.note}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

/* ---- policy ------------------------------------------------------------- */

export const PolicyCard = ({
  state,
  cells,
  details,
  capFill,
  capOver,
}: {
  readonly state: CardState;
  readonly cells: readonly Cell[];
  readonly details: readonly string[];
  /** 0 to 1, clamped: how much of the cap this swap uses. */
  readonly capFill: number;
  readonly capOver: boolean;
}) => (
  <div className={shell(state)}>
    <Head
      title="Policy"
      note="your rules, checked in order"
      state={state}
      renderMark={({ className }) => (
        <Icon icon={Key01Icon} aria-hidden strokeWidth={1.7} className={className ?? ""} />
      )}
      badge={<Badge>session key</Badge>}
    />
    <div className="flex flex-1 flex-col divide-y-1 divide-border/70">
      {POLICY_CHECKS.map((check, index) => {
        const cell = cells[index] ?? "idle";
        return (
          <div key={check.label} className="flex flex-1 items-center gap-2.5 px-3 py-1.5">
            <Pip state={cell} />
            <span
              className={cn(
                "w-[4.25rem] shrink-0 truncate text-[0.75rem]",
                cell === "fail"
                  ? "text-danger"
                  : cell === "idle"
                    ? "text-ink-subtle"
                    : "text-foreground",
              )}
            >
              {check.label}
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              {/* the page's motif: a value running to a fixed ceiling, and stopping there */}
              {index === 0 ? (
                <span className="h-1 w-8 shrink-0 overflow-hidden rounded-full bg-hairline-strong">
                  <span
                    className={cn(
                      "block h-full rounded-full transition-[width,background-color] duration-500 ease-out-quad",
                      capOver ? "bg-danger" : "bg-accent",
                    )}
                    style={{ width: `${String(Math.round(Math.min(capFill, 1) * 100))}%` }}
                  />
                </span>
              ) : null}
              <span
                className={cn(
                  "min-w-0 truncate text-right text-[0.6875rem]",
                  cell === "fail" ? "text-danger/85" : "text-ink-subtle",
                )}
              >
                {cell === "skipped" ? "not reached" : (details[index] ?? check.detail)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

/* ---- the rest ----------------------------------------------------------- */

const Note = ({
  children,
  tone,
}: {
  readonly children: React.ReactNode;
  readonly tone?: "danger";
}) => (
  <div className="flex flex-1 items-center px-3">
    <p
      className={cn(
        "truncate text-[0.6875rem]",
        tone === "danger" ? "text-danger/90" : "text-ink-subtle",
      )}
    >
      {children}
    </p>
  </div>
);

export const SignCard = ({ state }: { readonly state: CardState }) => (
  <div className={shell(state)}>
    <Head
      title="Sign"
      note="on your own machine"
      state={state}
      renderMark={({ className }) => (
        <Icon icon={SignatureIcon} aria-hidden strokeWidth={1.7} className={className ?? ""} />
      )}
    />
    <Note>{state === "skipped" ? "not reached" : "the key never leaves it"}</Note>
  </div>
);

export const SubmitCard = ({ state }: { readonly state: CardState }) => (
  <div className={shell(state)}>
    <Head
      title="Send"
      note="handed to the network"
      state={state}
      renderMark={({ className }) => (
        <Icon icon={Package01Icon} aria-hidden strokeWidth={1.7} className={className ?? ""} />
      )}
      badge={<AlchemyIcon aria-hidden className="size-[1.125rem] shrink-0" />}
    />
    <Note>{state === "skipped" ? "not reached" : "gas already covered"}</Note>
  </div>
);

export const ChainCard = ({
  state,
  chain,
  chainLabel,
}: {
  readonly state: CardState;
  readonly chain: ChainId;
  readonly chainLabel: string;
}) => (
  <div className={cn(shell(state), state === "done" && "border-success/45")}>
    <Head
      title="Confirmed"
      note="the swap is on the chain"
      state={state}
      renderMark={({ className }) => (
        <Icon
          icon={state === "done" ? Tick02Icon : Blockchain01Icon}
          aria-hidden
          strokeWidth={1.8}
          className={cn(className, state === "done" && "text-success")}
        />
      )}
      badge={
        <ChainIcon
          namespace="eip155"
          chain={chain}
          aria-hidden
          className="size-[1.125rem] shrink-0 rounded-[3px]"
        />
      }
    />
    <div className="flex flex-1 flex-col divide-y-1 divide-border/70">
      <div className="flex flex-1 items-center justify-between gap-2 px-3">
        <span className="text-[0.6875rem] text-ink-subtle">Network</span>
        <span className="truncate text-[0.6875rem] text-muted">{chainLabel}</span>
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 px-3">
        <span className="text-[0.6875rem] text-ink-subtle">Gas paid</span>
        <span
          className={cn(
            "truncate text-[0.6875rem]",
            state === "done" ? "text-success" : "text-ink-subtle",
          )}
        >
          {state === "done" ? "none" : "not reached"}
        </span>
      </div>
    </div>
  </div>
);

export const RefusedCard = ({
  state,
  reason,
}: {
  readonly state: CardState;
  readonly reason: string;
}) => (
  <div className={shell(state)}>
    <Head
      title="Refused"
      note="before anything was signed"
      state={state}
      renderMark={({ className }) => (
        <Icon icon={CancelCircleIcon} aria-hidden strokeWidth={1.7} className={className ?? ""} />
      )}
    />
    <Note {...(state === "failed" ? { tone: "danger" as const } : {})}>{reason}</Note>
  </div>
);
