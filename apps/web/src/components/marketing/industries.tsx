import { useState } from "react";

import {
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
 * Industries.
 *
 * The same "one vertical at a time" tabbed panel the reference site uses, rebuilt
 * on this page's own primitives: our tokens, our icon set, a hand-rolled tab
 * control with real ARIA roles rather than the old component and its motion
 * stack. Left half names the vertical, right half lists what an agent does there.
 * ---------------------------------------------------------------------- */

type Industry = {
  readonly key: string;
  readonly label: string;
  readonly icon: IconSvgElement;
  readonly title: string;
  readonly tagline: string;
  readonly capabilities: readonly string[];
};

const INDUSTRIES: readonly [Industry, ...Industry[]] = [
  {
    key: "defi",
    label: "DeFi",
    icon: ChartLineData01Icon,
    title: "DeFi & Trading Platforms",
    tagline: "Let agents manage and execute strategies within defined limits.",
    capabilities: [
      "Automated trading (arbitrage, liquidity provision, execution)",
      "Portfolio rebalancing across protocols and chains",
      "Strategy-driven actions with strict risk controls",
      "High-frequency trading",
    ],
  },
  {
    key: "ai",
    label: "AI Agents",
    icon: Robot01Icon,
    title: "AI Agent Platforms",
    tagline: "The permission layer for AI agent platforms.",
    capabilities: [
      "Agents executing transactions on behalf of users",
      "Tool-using agents interacting with smart contracts",
      "Autonomous workflows with scoped permissions",
    ],
  },
  {
    key: "commerce",
    label: "Commerce",
    icon: ShoppingCart01Icon,
    title: "Agentic Commerce",
    tagline: "Let agents discover, decide, and transact on behalf of users.",
    capabilities: [
      "Automated purchasing and checkout",
      "Subscription management and optimization",
      "Agents paying for APIs, compute, and services",
      "Refunds, payouts, and transaction handling",
    ],
  },
  {
    key: "fintech",
    label: "Fintech",
    icon: Wallet01Icon,
    title: "Wallets & Fintech Apps",
    tagline: "Upgrade wallets into programmable systems.",
    capabilities: [
      "Delegate limited access to apps and services",
      "Enable automation without compromising custody",
      "Add policy-based controls for users",
    ],
  },
  {
    key: "gaming",
    label: "Gaming",
    icon: GameController01Icon,
    title: "Gaming & Onchain Economies",
    tagline: "Let agents control in-game assets, play, spend, and act under defined rules.",
    capabilities: [
      "AI-driven asset and resource management",
      "Autonomous in-game economies",
      "Controlled execution of in-game actions",
    ],
  },
];

export const Industries = () => {
  const [activeKey, setActiveKey] = useState(INDUSTRIES[0].key);
  const active = INDUSTRIES.find((industry) => industry.key === activeKey) ?? INDUSTRIES[0];

  return (
    <Section id="industries" className="border-t-1 border-border">
      <Container>
        <Reveal>
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="type-eyebrow text-ink-subtle">Industries</p>
            <h2 className="type-display-lg max-w-[20ch] text-balance text-foreground">
              Built for every vertical
            </h2>
          </div>
        </Reveal>

        <Reveal delay={0.06} className="mt-10 md:mt-14">
          <div
            role="tablist"
            aria-label="Industries"
            className="mx-auto flex max-w-full flex-wrap justify-center gap-1.5"
          >
            {INDUSTRIES.map((industry) => {
              const isActive = industry.key === activeKey;
              return (
                <button
                  key={industry.key}
                  type="button"
                  role="tab"
                  id={`industry-tab-${industry.key}`}
                  aria-selected={isActive}
                  aria-controls={`industry-panel-${industry.key}`}
                  onClick={() => {
                    setActiveKey(industry.key);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border-1 px-3.5 py-2",
                    "text-[0.8125rem] font-medium transition-colors duration-150 ease-out-quad",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
                    isActive
                      ? "border-hairline-strong bg-surface/70 text-foreground"
                      : "border-transparent text-muted hover:text-foreground",
                  )}
                >
                  <Icon
                    icon={industry.icon}
                    strokeWidth={1.7}
                    className="size-4 shrink-0"
                    aria-hidden
                  />
                  <span>{industry.label}</span>
                </button>
              );
            })}
          </div>

          <div
            id={`industry-panel-${active.key}`}
            role="tabpanel"
            aria-labelledby={`industry-tab-${active.key}`}
            className="mx-auto mt-8 max-w-[64rem] overflow-hidden rounded-xl border-1 border-border bg-surface/20"
          >
            <div className="grid md:min-h-[15rem] md:grid-cols-2">
              <div className="flex flex-col gap-4 border-b-1 border-border p-6 md:border-r-1 md:border-b-0 md:p-8">
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-xl border-1 border-hairline-strong bg-default/50 text-muted"
                >
                  <Icon icon={active.icon} strokeWidth={1.7} className="size-4" />
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-[1.25rem] font-medium tracking-[-0.01em] text-foreground">
                    {active.title}
                  </h3>
                  <p className="type-body text-muted">{active.tagline}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 p-6 md:p-8">
                <p className="type-mono text-[0.625rem] uppercase tracking-[0.12em] text-ink-subtle">
                  Capabilities
                </p>
                <div className="flex flex-col gap-2">
                  {active.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="rounded-lg border-1 border-border bg-surface/40 px-3 py-2 text-[0.875rem] leading-snug text-muted"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
};
