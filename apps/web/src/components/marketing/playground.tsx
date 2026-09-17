import { useEffect, useId, useState } from "react";

import {
  CancelCircleIcon,
  ChainIcon,
  CheckmarkCircle02Icon,
  Icon,
  Loading03Icon,
  TokenIcon,
} from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Container, Reveal, Section, SectionIntro } from "#/components/marketing/primitives";

/* -------------------------------------------------------------------------
 * The playground.
 *
 * A swap on the left, the key that is allowed to make it on the right, and
 * the decision underneath the policy rather than under the swap — because the
 * decision belongs to the policy, not to the request.
 *
 * One pair, two networks, and different limits on each: the same swap that
 * goes through on Base is refused on Ethereum, which is the fastest way to
 * show that the limits are real and per-network.
 *
 * Run evaluates in order and stops at the first failure, the way the real
 * checker does. Rules after a refusal are marked not reached rather than
 * passing — a demo that fakes that is lying about the one thing this page is
 * trying to prove.
 * ---------------------------------------------------------------------- */

type TokenId = "ETH" | "USDC";
type NetworkId = "ethereum" | "base";

const TOKENS: Record<TokenId, { readonly name: string; readonly usd: number }> = {
  ETH: { name: "Ether", usd: 2400 },
  USDC: { name: "USD Coin", usd: 1 },
};

const NETWORKS: Record<
  NetworkId,
  {
    readonly name: string;
    readonly perTx: Record<TokenId, number>;
    readonly cap: number;
    readonly used: number;
  }
> = {
  ethereum: { name: "Ethereum", perTx: { ETH: 0.02, USDC: 40 }, cap: 100, used: 62 },
  base: { name: "Base", perTx: { ETH: 0.05, USDC: 120 }, cap: 250, used: 40 },
};

const EXPIRES = "27 Sept 2026";

const DEFAULT_AMOUNT: Record<TokenId, string> = { ETH: "0.01", USDC: "25" };

const amountOf = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const trim = (n: number, places: number) =>
  n
    .toFixed(places)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");

/** Places that suit the magnitude, so 0.004 ETH never renders as "0". */
const fmt = (n: number) => {
  if (n === 0) return "0";
  return trim(n, n >= 1000 ? 0 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6);
};

const usd = (n: number) =>
  n >= 100 ? `$${n.toFixed(0)}` : `$${n.toFixed(2).replace(/\.00$/, "")}`;

type Rule = {
  readonly id: string;
  readonly label: string;
  readonly allowed: string;
  readonly pass: boolean;
  readonly failure: string;
};

const evaluate = (from: TokenId, value: string, network: NetworkId): Rule[] => {
  const amount = amountOf(value);
  const worth = amount * TOKENS[from].usd;
  const net = NETWORKS[network];
  const cap = net.perTx[from];
  const left = net.cap - net.used;

  return [
    {
      id: "tokens",
      label: "Token list",
      allowed: "ETH, USDC",
      pass: true,
      failure: "",
    },
    {
      id: "per-tx",
      label: `Per transaction on ${net.name}`,
      allowed: `${fmt(cap)} ${from}`,
      pass: amount > 0 && amount <= cap,
      failure:
        amount === 0
          ? "Enter an amount"
          : `${fmt(amount)} ${from} is over the ${fmt(cap)} ${from} limit on ${net.name}`,
    },
    {
      id: "period",
      label: `Left this period on ${net.name}`,
      allowed: `${fmt(left)} of ${String(net.cap)} USDC`,
      pass: worth <= left,
      failure: `${usd(worth)} would take ${net.name} past its ${String(net.cap)} USDC period cap`,
    },
    { id: "expiry", label: "Expires", allowed: EXPIRES, pass: true, failure: "" },
  ];
};

/* --------------------------------- parts ---------------------------------- */

/** The official marks, from the design system. */
const TokenMark = ({ token }: { readonly token: TokenId }) => (
  <span
    aria-hidden
    className={cn(
      "grid size-6 shrink-0 place-items-center rounded-full",
      token === "ETH" && "bg-default/80",
    )}
  >
    <TokenIcon symbol={token} className={token === "ETH" ? "size-4" : "size-6"} />
  </span>
);

const TokenChip = ({ token }: { readonly token: TokenId }) => (
  <span className="flex shrink-0 items-center gap-2 rounded-full border-1 border-border bg-surface/60 py-1.5 pr-3 pl-1.5">
    <TokenMark token={token} />
    <span className="text-[0.875rem] font-medium text-foreground">{token}</span>
  </span>
);

const RuleRow = ({
  rule,
  state,
}: {
  readonly rule: Rule;
  readonly state: "idle" | "checking" | "pass" | "fail" | "skipped";
}) => (
  <div className="flex items-start gap-3 border-t-1 border-border py-2.5 first:border-t-0">
    <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
      {state === "checking" ? (
        <Icon
          icon={Loading03Icon}
          aria-hidden
          strokeWidth={2}
          className="size-3.5 animate-spin text-ink-subtle"
        />
      ) : state === "pass" ? (
        <Icon
          icon={CheckmarkCircle02Icon}
          aria-hidden
          strokeWidth={1.9}
          className="size-3.5 text-success"
        />
      ) : state === "fail" ? (
        <Icon
          icon={CancelCircleIcon}
          aria-hidden
          strokeWidth={1.9}
          className="size-3.5 text-danger"
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            state === "skipped" ? "bg-ink-subtle/30" : "bg-ink-subtle/60",
          )}
        />
      )}
    </span>

    <span className="min-w-0 flex-1">
      <span className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            "text-[0.8125rem]",
            state === "skipped" ? "text-ink-subtle/60" : "text-foreground",
          )}
        >
          {rule.label}
        </span>
        <span className="shrink-0 text-[0.75rem] tabular-nums text-ink-subtle">{rule.allowed}</span>
      </span>
      {state === "fail" ? (
        <span className="mt-1 block text-[0.75rem] text-danger">{rule.failure}</span>
      ) : state === "skipped" ? (
        <span className="mt-1 block text-[0.75rem] text-ink-subtle/60">Not reached</span>
      ) : null}
    </span>
  </div>
);

/* ------------------------------- the section ------------------------------- */

export const Playground = () => {
  const reduced = useReducedMotion() ?? false;
  const fieldId = useId();

  const [from, setFrom] = useState<TokenId>("ETH");
  const [value, setValue] = useState(DEFAULT_AMOUNT.ETH);
  const [network, setNetwork] = useState<NetworkId>("ethereum");

  /** -1 idle, 0..n checking that rule, past the end settled. */
  const [cursor, setCursor] = useState(-1);
  const [settled, setSettled] = useState(false);

  const to: TokenId = from === "ETH" ? "USDC" : "ETH";
  const rules = evaluate(from, value, network);
  const firstFailure = rules.findIndex((rule) => !rule.pass);
  const lastChecked = firstFailure === -1 ? rules.length - 1 : firstFailure;

  const amount = amountOf(value);
  const receives = amount * (TOKENS[from].usd / TOKENS[to].usd);
  const running = cursor >= 0 && !settled;

  /** Any edit invalidates the run on screen. */
  const reset = () => {
    setCursor(-1);
    setSettled(false);
  };

  useEffect(() => {
    if (cursor < 0 || settled) return;

    if (cursor > lastChecked) {
      setSettled(true);
      return;
    }

    const timer = setTimeout(
      () => {
        setCursor((c) => c + 1);
      },
      reduced ? 60 : 280,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [cursor, lastChecked, reduced, settled]);

  const stateOf = (index: number) => {
    if (cursor < 0) return "idle" as const;
    if (index > lastChecked) return settled ? ("skipped" as const) : ("idle" as const);
    if (index > cursor) return "idle" as const;
    if (index === cursor && !settled) return "checking" as const;
    return rules[index]?.pass ? ("pass" as const) : ("fail" as const);
  };

  const verdict = settled ? (firstFailure === -1 ? "allowed" : "refused") : null;

  return (
    <Section id="playground" className="border-t-1 border-border">
      <Container>
        <Reveal>
          <SectionIntro title="Try to spend past the limit">
            Change the amount or the network, then run it. The same swap passes for the default
            amount but fails when increased.
          </SectionIntro>
        </Reveal>

        <Reveal delay={0.06} className="mt-12">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
            {/* ------------------------------ the swap ----------------------------- */}
            <div className="edge-top relative flex flex-col overflow-hidden rounded-xl border-1 border-border bg-surface/40">
              <div className="flex items-center justify-between gap-3 border-b-1 border-border px-4 py-3 sm:px-5">
                <p className="text-[0.8125rem] font-medium text-foreground">Uniswap Agent</p>
                <div className="flex items-center gap-1">
                  {(Object.keys(NETWORKS) as NetworkId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={network === id}
                      onClick={() => {
                        setNetwork(id);
                        reset();
                      }}
                      className={
                        cn(
                          "tap-target flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem]",
                          "transition-colors duration-150 ease-out-quad",
                          "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus/60",
                          network === id
                            ? "bg-default/80 text-foreground"
                            : "text-ink-subtle hover:text-muted",
                        ) ?? ""
                      }
                    >
                      <ChainIcon
                        namespace="eip155"
                        chain={id}
                        aria-hidden
                        className="size-3.5 rounded-[3px]"
                      />
                      {NETWORKS[id].name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1 p-4 sm:p-5">
                {/* pay */}
                <div className="rounded-xl border-1 border-border bg-canvas/60 px-4 py-3.5">
                  <label htmlFor={fieldId} className="text-[0.75rem] text-ink-subtle">
                    You pay
                  </label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      id={fieldId}
                      inputMode="decimal"
                      value={value}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (/^\d*\.?\d*$/.test(next)) {
                          setValue(next);
                          reset();
                        }
                      }}
                      className={
                        cn(
                          "min-w-0 flex-1 bg-transparent text-[1.5rem] tracking-[-0.02em] tabular-nums",
                          "text-foreground outline-none placeholder:text-ink-subtle/50",
                        ) ?? ""
                      }
                      placeholder="0"
                    />
                    <TokenChip token={from} />
                  </div>
                  <p className="mt-1.5 text-[0.75rem] text-ink-subtle">
                    {usd(amount * TOKENS[from].usd)}
                  </p>
                </div>

                {/* reverse */}
                <div className="relative z-10 -my-3.5 flex justify-center">
                  <button
                    type="button"
                    aria-label={`Reverse: pay in ${to} instead`}
                    onClick={() => {
                      setFrom(to);
                      setValue(DEFAULT_AMOUNT[to]);
                      reset();
                    }}
                    className={
                      cn(
                        "grid size-8 place-items-center rounded-lg border-1 border-border bg-surface",
                        "text-muted transition-colors duration-150 ease-out-quad",
                        "hover:border-hairline-strong hover:text-foreground",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
                      ) ?? ""
                    }
                  >
                    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none">
                      <path
                        d="M5 2v9M5 11 2.5 8.5M5 11l2.5-2.5M11 14V5M11 5l2.5 2.5M11 5 8.5 7.5"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* receive */}
                <div className="rounded-xl border-1 border-border bg-canvas/60 px-4 py-3.5">
                  <p className="text-[0.75rem] text-ink-subtle">You receive</p>
                  <div className="mt-2 flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate text-[1.5rem] tracking-[-0.02em] tabular-nums text-foreground">
                      {fmt(receives)}
                    </p>
                    <TokenChip token={to} />
                  </div>
                  <p className="mt-1.5 text-[0.75rem] text-ink-subtle">
                    1 {from} = {fmt(TOKENS[from].usd / TOKENS[to].usd)} {to}
                    <span className="text-ink-subtle/70"> · sample quote</span>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={running}
                  onClick={() => {
                    setSettled(false);
                    setCursor(0);
                  }}
                  className={
                    cn(
                      "tap-target mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3",
                      "text-[0.9375rem] font-medium transition-colors duration-150 ease-out-quad",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
                      running
                        ? "bg-default/70 text-muted"
                        : "bg-accent text-white hover:bg-accent/85",
                    ) ?? ""
                  }
                >
                  {running ? (
                    <Icon
                      icon={Loading03Icon}
                      aria-hidden
                      strokeWidth={2}
                      className="size-4 animate-spin"
                    />
                  ) : null}
                  {running ? "Checking" : settled ? "Swap again" : "Swap"}
                </button>
              </div>
            </div>

            {/* --------------------- the policy, and the decision -------------------- */}
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border-1 border-border bg-surface/25">
                <div className="border-b-1 border-border px-4 py-3 sm:px-5">
                  <p className="text-[0.8125rem] font-medium text-foreground">
                    What this key may do
                  </p>
                  <p className="mt-1 text-[0.75rem] text-ink-subtle">
                    Set when the key was issued. The agent cannot change it.
                  </p>
                </div>

                <div className="flex flex-col px-4 py-2 sm:px-5">
                  {rules.map((rule, index) => (
                    <RuleRow key={rule.id} rule={rule} state={stateOf(index)} />
                  ))}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {verdict ? (
                  <motion.div
                    key={verdict}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <output
                      className={cn(
                        "flex items-start gap-3 rounded-xl border-1 px-4 py-3.5 sm:px-5",
                        verdict === "allowed"
                          ? "border-success/25 bg-success/8"
                          : "border-danger/25 bg-danger/8",
                      )}
                    >
                      <Icon
                        icon={verdict === "allowed" ? CheckmarkCircle02Icon : CancelCircleIcon}
                        aria-hidden
                        strokeWidth={1.9}
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          verdict === "allowed" ? "text-success" : "text-danger",
                        )}
                      />
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-[0.8125rem] font-medium",
                            verdict === "allowed" ? "text-success" : "text-danger",
                          )}
                        >
                          {verdict === "allowed" ? "Signed and submitted" : "Refused"}
                        </p>
                        <p className="mt-1 text-[0.75rem] text-muted">
                          {verdict === "allowed" ? (
                            <>
                              Swapped {fmt(amount)} {from} for {fmt(receives)} {to} on{" "}
                              {NETWORKS[network].name}.{" "}
                              <span className="type-mono text-[0.6875rem] text-ink-subtle">
                                0x7c31…a904
                              </span>
                            </>
                          ) : (
                            <>
                              {rules[firstFailure]?.failure}. No signature was produced and no gas
                              was spent.
                            </>
                          )}
                        </p>
                      </div>
                    </output>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
};
