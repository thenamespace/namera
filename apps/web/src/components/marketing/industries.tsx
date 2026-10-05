import {
  ChainIcon,
  type ChainIconProps,
  ChartLineData01Icon,
  GameController01Icon,
  Icon,
  type IconSvgElement,
  Robot01Icon,
  ShoppingCart01Icon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { Container, Reveal, Section } from "#/components/marketing/primitives";

/* -------------------------------------------------------------------------
 * Where this gets used.
 *
 * Two earlier versions of this section argued in prose — a tab per vertical
 * over a panel of capability bullets. Both were a page of reading for a point
 * that is better shown: the same key, issued five different ways.
 *
 * So the section shows the keys. Ten of them drift past, each one a real grant
 * with a name, a meter against its cap, the networks it may touch and the day
 * it dies. The verticals are named once, in a line at the bottom. Nothing here
 * is a live figure and nothing pretends to be — these are samples, the way a
 * product shot is a sample.
 * ---------------------------------------------------------------------- */

type Chain = ChainIconProps["chain"];

type KeyCard = {
  readonly agent: string;
  readonly vertical: string;
  readonly icon: IconSvgElement;
  readonly spent: string;
  readonly cap: string;
  /** The period the cap resets over — "today", "this week". */
  readonly period: string;
  /** How much of the cap is drawn, 0–1. */
  readonly fill: number;
  readonly chains: readonly [Chain, ...Chain[]];
  readonly expiry: string;
};

const ROW_ONE: readonly KeyCard[] = [
  {
    agent: "Arb desk",
    vertical: "Trading",
    icon: ChartLineData01Icon,
    spent: "$412",
    cap: "$2,000",
    period: "today",
    fill: 0.21,
    chains: ["base", "arbitrum"],
    expiry: "6d left",
  },
  {
    agent: "Research runner",
    vertical: "AI agents",
    icon: Robot01Icon,
    spent: "$62",
    cap: "$100",
    period: "today",
    fill: 0.62,
    chains: ["base"],
    expiry: "22h left",
  },
  {
    agent: "Restock agent",
    vertical: "Commerce",
    icon: ShoppingCart01Icon,
    spent: "$86",
    cap: "$250",
    period: "this week",
    fill: 0.34,
    chains: ["base"],
    expiry: "24d left",
  },
  {
    agent: "Guild steward",
    vertical: "Gaming",
    icon: GameController01Icon,
    spent: "$17",
    cap: "$20",
    period: "today",
    fill: 0.85,
    chains: ["base"],
    expiry: "season",
  },
  {
    agent: "Allowance keeper",
    vertical: "Wallets",
    icon: Wallet01Icon,
    spent: "$120",
    cap: "$400",
    period: "this month",
    fill: 0.3,
    chains: ["ethereum", "base"],
    expiry: "90d left",
  },
];

const ROW_TWO: readonly KeyCard[] = [
  {
    agent: "LP rebalancer",
    vertical: "Trading",
    icon: ChartLineData01Icon,
    spent: "$3,540",
    cap: "$5,000",
    period: "today",
    fill: 0.71,
    chains: ["arbitrum", "optimism"],
    expiry: "3d left",
  },
  {
    agent: "Checkout bot",
    vertical: "Commerce",
    icon: ShoppingCart01Icon,
    spent: "$112",
    cap: "$150",
    period: "today",
    fill: 0.75,
    chains: ["base"],
    expiry: "30d left",
  },
  {
    agent: "Tool budget",
    vertical: "AI agents",
    icon: Robot01Icon,
    spent: "$7",
    cap: "$50",
    period: "today",
    fill: 0.14,
    chains: ["base"],
    expiry: "24h left",
  },
  {
    agent: "Payouts float",
    vertical: "Wallets",
    icon: Wallet01Icon,
    spent: "$5,500",
    cap: "$10,000",
    period: "this week",
    fill: 0.55,
    chains: ["ethereum", "base"],
    expiry: "14d left",
  },
  {
    agent: "Tournament purse",
    vertical: "Gaming",
    icon: GameController01Icon,
    spent: "$60",
    cap: "$500",
    period: "this event",
    fill: 0.12,
    chains: ["base"],
    expiry: "48h left",
  },
];

const INDUSTRIES = [
  "Trading desks",
  "AI agent platforms",
  "Agentic commerce",
  "Wallets & fintech",
  "Onchain games",
] as const;

/* -------------------------------------------------------------------------- */

/** One issued key, as the dashboard would draw it. */
const Card = ({ card }: { readonly card: KeyCard }) => (
  <article
    className={cn(
      "edge-top mr-4 flex w-[18.5rem] shrink-0 flex-col rounded-xl p-5",
      "border-1 border-border bg-surface/50",
      "transition-colors duration-200 ease-out-quad hover:border-hairline-strong hover:bg-surface/80",
    )}
  >
    <header className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-lg border-1 border-hairline-strong bg-default/60 text-muted"
        >
          <Icon icon={card.icon} strokeWidth={1.7} className="size-4" />
        </span>
        <span className="flex flex-col">
          <span className="text-[0.875rem] leading-tight font-medium text-foreground">
            {card.agent}
          </span>
          <span className="type-mono mt-0.5 text-[0.625rem] tracking-[0.1em] text-ink-subtle uppercase">
            {card.vertical}
          </span>
        </span>
      </span>

      <span className="flex items-center gap-1.5 pt-1">
        <span aria-hidden className="size-1.5 rounded-full bg-accent" />
        <span className="text-[0.6875rem] text-ink-subtle">Live</span>
      </span>
    </header>

    <div className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.8125rem] text-muted">
          <span className="font-medium text-foreground">{card.spent}</span> of {card.cap}
        </span>
        <span className="text-[0.6875rem] text-ink-subtle">{card.period}</span>
      </div>
      {/* The meter is decoration over the figures above, which already say it. */}
      <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-default">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${String(Math.round(card.fill * 100))}%` }}
        />
      </div>
    </div>

    <footer className="mt-5 flex items-center justify-between gap-3 border-t-1 border-border pt-4">
      <span className="flex items-center gap-1.5">
        {card.chains.map((chain) => (
          <span
            key={chain}
            className="flex items-center gap-1.5 rounded-md border-1 border-border bg-default/40 py-0.5 pr-2 pl-1.5"
          >
            <ChainIcon namespace="eip155" chain={chain} aria-hidden className="size-3" />
            <span className="text-[0.6875rem] text-muted capitalize">{chain}</span>
          </span>
        ))}
      </span>
      <span className="text-[0.6875rem] whitespace-nowrap text-ink-subtle">{card.expiry}</span>
    </footer>
  </article>
);

/*
 * A row that drifts.
 *
 * The track holds the row twice and travels exactly half its width, so the
 * second copy is under the cursor at the moment the first runs out. The gap
 * lives on the cards as a right margin rather than on the flex container,
 * because a container gap would add one extra gap between the copies and the
 * seam would show. The duplicate is hidden from assistive tech.
 */
const DriftRow = ({
  cards,
  seconds,
  reverse = false,
}: {
  readonly cards: readonly KeyCard[];
  readonly seconds: number;
  readonly reverse?: boolean;
}) => (
  <div className="drift-row">
    <div
      className="drift-track"
      data-reverse={reverse ? "" : undefined}
      style={{ animationDuration: `${String(seconds)}s` }}
    >
      {[0, 1].map((copy) => (
        <div key={copy} className="flex" aria-hidden={copy === 1 || undefined}>
          {cards.map((card) => (
            <Card key={card.agent} card={card} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */

export const Industries = () => (
  <Section id="industries" className="border-t-1 border-border">
    <Container>
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-16">
          <h2 className="type-display-lg max-w-[14ch] text-balance text-foreground">
            Every agent, its own fence
          </h2>
          <div className="flex flex-col items-start gap-5 lg:pt-2">
            <p className="type-lead max-w-[46ch] text-pretty text-muted">
              A trading desk, a checkout bot, a steward inside a game. The wallet never changes -
              the budget, the networks and the expiry do.
            </p>
            <a
              href="#playground"
              className="group/link inline-flex items-center gap-1.5 text-[0.9375rem] text-foreground transition-colors duration-150 ease-out-quad hover:text-ink-subtle"
            >
              Try one against its limit
              <span
                aria-hidden
                className="transition-transform duration-150 ease-out-quad group-hover/link:translate-x-0.5"
              >
                →
              </span>
            </a>
          </div>
        </div>
      </Reveal>
    </Container>

    {/* Full bleed: the rows run off both edges, so the page is a window on them. */}
    <Reveal className="mt-16 flex flex-col gap-4 md:mt-24">
      <DriftRow cards={ROW_ONE} seconds={72} />
      <DriftRow cards={ROW_TWO} seconds={88} reverse />
    </Reveal>

    <Container className="mt-16 md:mt-24">
      <Reveal>
        <div className="grid gap-y-4 border-t-1 border-border pt-6 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-x-10">
          <p className="text-[0.8125rem] text-ink-subtle">Industries</p>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
            {INDUSTRIES.map((industry) => (
              <li key={industry} className="text-[0.9375rem] text-balance text-muted">
                {industry}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </Container>
  </Section>
);
