/** biome-ignore-all lint/style/noNonNullAssertion: safe */
import { useState } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@namera-ai/ui/components/ui/tabs";
import {
  ChartLineUpIcon,
  GameControllerIcon,
  RobotIcon,
  ShoppingCartIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { motion, stagger, type Variants } from "motion/react";

import { AmbientGlow, CardGlow, Hr } from "@/components/misc";

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    y: 0,
  },
};

const industries = [
  {
    bullets: [
      "Automated trading (arbitrage, liquidity provision, execution)",
      "Portfolio rebalancing across protocols and chains",
      "Strategy-driven actions with strict risk controls",
      "High-frequency trading",
    ],
    icon: ChartLineUpIcon,
    key: "defi",
    label: "DeFi",
    tagline: "Let agents manage and execute strategies within defined limits.",
    title: "DeFi & Trading Platforms",
  },
  {
    bullets: [
      "Agents executing transactions on behalf of users",
      "Tool-using agents interacting with smart contracts",
      "Autonomous workflows with scoped permissions",
    ],
    icon: RobotIcon,
    key: "ai",
    label: "AI Agents",
    tagline: "The permission layer for AI agent platforms.",
    title: "AI Agent Platforms",
  },
  {
    bullets: [
      "Automated purchasing and checkout",
      "Subscription management and optimization",
      "Agents paying for APIs, compute, and services",
      "Refunds, payouts, and transaction handling",
    ],
    icon: ShoppingCartIcon,
    key: "commerce",
    label: "Commerce",
    tagline: "Let agents discover, decide, and transact on behalf of users.",
    title: "Agentic Commerce",
  },
  {
    bullets: [
      "Delegate limited access to apps and services",
      "Enable automation without compromising custody",
      "Add policy-based controls for users",
    ],
    icon: WalletIcon,
    key: "fintech",
    label: "Fintech",
    tagline: "Upgrade wallets into programmable systems.",
    title: "Wallets & Fintech Apps",
  },
  {
    bullets: [
      "AI-driven asset and resource management",
      "Autonomous in-game economies",
      "Controlled execution of in-game actions",
    ],
    icon: GameControllerIcon,
    key: "gaming",
    label: "Gaming",
    tagline:
      "Let agents control in-game assets, play, spend, and execute actions under defined rules.",
    title: "Gaming & Onchain Economies",
  },
];

export const Industries = () => {
  const [active, setActive] = useState(industries[0]!);

  return (
    <section
      className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-[10dvh] md:gap-14 md:py-[12dvh]"
      id="industries"
    >
      <Hr />
      <AmbientGlow />
      <motion.div
        className="flex flex-col gap-3"
        initial="hidden"
        variants={sectionVariants}
        viewport={{ margin: "-80px", once: true }}
        whileInView="visible"
      >
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Industries
        </p>
        <h2 className="heading-gradient mx-auto max-w-2xl pb-2 text-center text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Built for every vertical
        </h2>
      </motion.div>

      <Tabs
        className="flex flex-col gap-8 md:gap-12"
        defaultValue={industries[0]!.key}
        onValueChange={(val) => {
          const selected = industries.find((i) => i.key === val);
          if (selected) setActive(selected);
        }}
        value={active.key}
      >
        <TabsList className="bg-background mx-auto flex max-w-full justify-start overflow-x-auto whitespace-nowrap px-2 py-2 no-scrollbar md:justify-center">
          {industries.map((industry) => (
            <TabsTrigger
              className="flex items-center gap-2 px-3 py-2 md:px-4 h-8"
              key={industry.key}
              value={industry.key}
            >
              <industry.icon className="size-4 shrink-0" />
              <span>{industry.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="relative mx-auto flex min-h-136 md:min-h-80 w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/2 backdrop-blur-sm">
          <div
            aria-hidden={true}
            className="pointer-events-none absolute inset-0 opacity-[0.018]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,1) 3px, rgba(255,255,255,1) 4px)",
            }}
          />
          <CardGlow />

          <TabsContent
            className="mt-0 flex w-full flex-col outline-none md:grid md:grid-cols-2"
            value={active.key}
          >
            <div className="z-10 flex h-full flex-col justify-start gap-6 p-6 md:border-r md:p-10">
              <div className="flex flex-col gap-4">
                <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-muted">
                  <active.icon className="size-4.5 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-semibold tracking-tight md:text-2xl">
                    {active.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                    {active.tagline}
                  </p>
                </div>
              </div>
            </div>
            <div className="z-10 flex flex-col justify-center gap-4 p-6 pb-24 pt-0 md:p-10 md:pb-10">
              <div className="font-geist-mono text-[10px] uppercase text-muted-foreground">
                Capabilities
              </div>
              <motion.div
                animate="visible"
                className="flex w-full flex-col gap-2"
                initial="hidden"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      delayChildren: stagger(0.06),
                    },
                  },
                }}
              >
                {active.bullets.map((bullet) => (
                  <motion.span
                    className="rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-sm leading-snug text-muted-foreground"
                    key={bullet}
                    variants={{
                      hidden: { opacity: 0, y: 15 },
                      visible: {
                        opacity: 1,
                        transition: {
                          damping: 20,
                          stiffness: 200,
                          type: "spring",
                        },
                        y: 0,
                      },
                    }}
                  >
                    {bullet}
                  </motion.span>
                ))}
              </motion.div>
            </div>
          </TabsContent>

          <motion.div
            aria-label="Industry tabs"
            className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 md:bottom-0 md:left-8 md:translate-x-0"
            initial={{ opacity: 1, y: -60 }}
            role="tablist"
            transition={{
              damping: 25,
              stiffness: 250,
              type: "spring",
            }}
          >
            {industries.map((ind) => {
              const isActive = ind.key === active.key;

              return (
                <motion.button
                  animate={{
                    backgroundColor: isActive
                      ? "rgba(255,255,255,0.4)"
                      : "rgba(255,255,255,0.12)",
                    width: isActive ? "1.25rem" : "0.375rem",
                  }}
                  aria-label={ind.label}
                  aria-selected={isActive}
                  className="h-1.5 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-white/40 focus-visible:outline-offset-2"
                  key={ind.key}
                  layout={true}
                  onClick={() => setActive(ind)}
                  role="tab"
                  transition={{
                    damping: 30,
                    stiffness: 300,
                    type: "spring",
                  }}
                  type="button"
                />
              );
            })}
          </motion.div>
        </div>
      </Tabs>
    </section>
  );
};
