import {
  ChartLineUpIcon,
  PlugsConnectedIcon,
  RepeatIcon,
  type WalletIcon,
} from "@phosphor-icons/react";
import { motion, type Variants } from "motion/react";

import { AmbientGlow, Hr } from "@/components/misc";

type Demo = {
  description: string;
  icon: typeof WalletIcon;
  key: string;
  policy: string[];
  tag: string;
  title: string;
};

const demos: Demo[] = [
  {
    description:
      "Let an agent buy API calls over x402 autonomously, bounded by a policy it can't exceed.",
    icon: PlugsConnectedIcon,
    key: "x402",
    policy: [
      "Max $5 / day",
      "Approved providers only",
      "USDC only",
      "Max 20 requests / hour",
      "Expires in 24h",
    ],
    tag: "x402",
    title: "Agent pays for APIs",
  },
  {
    description:
      "Let an agent rebalance a small portfolio on a schedule, without ever going rogue.",
    icon: ChartLineUpIcon,
    key: "trading",
    policy: [
      "Uniswap only",
      "USDC / WETH only",
      "Max $100 per trade",
      "Max 3 trades / day",
      "No arbitrary contract calls",
    ],
    tag: "DeFi",
    title: "Agent trades with limits",
  },
  {
    description:
      "Let an agent handle recurring SaaS and MCP payments, revocable by the user at any time.",
    icon: RepeatIcon,
    key: "subscriptions",
    policy: [
      "Approved merchants only",
      "Fixed recurring amounts",
      "Revocable anytime",
      "No access to the primary key",
    ],
    tag: "MPP",
    title: "Agent pays subscriptions",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.15, staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    y: 0,
  },
};

const DemoCard = ({ demo }: { demo: Demo }) => {
  const Icon = demo.icon;
  return (
    <motion.div
      className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/2 backdrop-blur-sm"
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.02), 0 8px 24px -12px rgba(0,0,0,0.6)",
      }}
      variants={itemVariants}
    >
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
        }}
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/3">
            <Icon className="size-6 text-white/80" weight="duotone" />
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-geist-mono text-[10px] uppercase tracking-[0.15em] text-white/50">
            {demo.tag}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {demo.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {demo.description}
          </p>
        </div>
      </div>

      <div className="mt-auto border-t border-white/10 bg-[#0b0c0d] p-6">
        <span className="font-geist-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
          Policy
        </span>
        <ul className="mt-3 flex flex-col gap-2.5">
          {demo.policy.map((rule) => (
            <li
              className="flex items-center gap-2.5 text-sm text-white/75"
              key={rule}
            >
              <span className="size-1 shrink-0 rounded-full bg-[#d6fe51]" />
              <span className="font-geist-mono text-[13px]">{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

export const Demos = () => {
  return (
    <motion.section
      className="relative mx-auto flex max-w-7xl flex-col gap-14 px-4 py-[12dvh]"
      id="demos"
      initial="hidden"
      variants={containerVariants}
      viewport={{ margin: "-100px", once: true }}
      whileInView="visible"
    >
      <Hr />
      <AmbientGlow />

      <motion.div
        className="relative flex flex-col items-center gap-3 text-center"
        variants={itemVariants}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          Use Cases
        </p>
        <h2 className="heading-gradient mx-auto max-w-2xl pb-2 text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Put agents to work, safely
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {demos.map((demo) => (
          <DemoCard demo={demo} key={demo.key} />
        ))}
      </div>
    </motion.section>
  );
};
