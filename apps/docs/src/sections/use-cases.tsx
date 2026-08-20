import {
  type BrainIcon,
  ClockCountdownIcon,
  CpuIcon,
  GaugeIcon,
  KeyIcon,
  RepeatIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { motion, type Variants } from "motion/react";

import { Hr } from "@/components";

type UseCase = {
  description: string;
  icon: typeof BrainIcon;
  key: string;
  title: string;
};

const useCases: UseCase[] = [
  {
    description:
      "Enforce onchain rules limiting contract calls, gas spend, and execution frequency.",
    icon: ShieldCheckIcon,
    key: "spending-guardrails",
    title: "Spending Guardrails",
  },
  {
    description:
      "Let users grant apps or agents controlled access to their wallets with defined limits.",
    icon: KeyIcon,
    key: "agents",
    title: "Delegated Wallet Access",
  },
  {
    description:
      "Let agents handle recurring payments automatically, within defined spend limits.",
    icon: RepeatIcon,
    key: "subscriptions",
    title: "Subscriptions",
  },
  {
    description:
      "Let autonomous systems pay each other, APIs, and services, without human involvement.",
    icon: CpuIcon,
    key: "machine-payments",
    title: "Machine Payments",
  },
  {
    description:
      "Charge users dynamically based on usage, API calls, or events.",
    icon: GaugeIcon,
    key: "usage-based-billing",
    title: "Usage-Based Billing",
  },
  {
    description:
      "Let agents execute trades, manage liquidity, and act on strategy automatically.",
    icon: ClockCountdownIcon,
    key: "automated-trading",
    title: "Automated Trading",
  },
];

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    y: 0,
  },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.1, staggerChildren: 0.06 },
  },
};

const UseCaseRow = ({
  useCase,
  index,
}: {
  index: number;
  useCase: UseCase;
}) => {
  const Icon = useCase.icon;
  const number = String(index + 1).padStart(2, "0");

  return (
    <motion.div
      className="group grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-t border-white/10 py-8 md:grid-cols-[3rem_5fr_6fr] md:items-baseline md:gap-x-10 md:py-9"
      variants={rowVariants}
    >
      <span className="font-geist-mono text-sm text-white/25 transition-colors duration-300 group-hover:text-white/50">
        {number}
      </span>

      <div className="flex items-center gap-3">
        <Icon
          className="size-5 shrink-0 text-white/40 transition-colors duration-300 group-hover:text-white/80"
          weight="regular"
        />
        <h3 className="text-lg font-medium tracking-tight text-white/90 transition-colors duration-300 group-hover:text-white sm:text-xl">
          {useCase.title}
        </h3>
      </div>

      <p className="col-start-2 max-w-xl text-sm leading-relaxed text-muted-foreground md:col-start-3">
        {useCase.description}
      </p>
    </motion.div>
  );
};

export const UseCases = () => {
  return (
    <motion.section
      className="relative mx-auto flex max-w-5xl flex-col gap-14 px-4 py-[12dvh]"
      id="use-cases"
      initial="hidden"
      variants={containerVariants}
      viewport={{ margin: "-100px", once: true }}
      whileInView="visible"
    >
      <Hr />

      <motion.div
        className="flex flex-col items-center gap-3 text-center"
        variants={rowVariants}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          Use Cases
        </p>
        <h2 className="heading-gradient mx-auto max-w-2xl pb-2 text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Wherever agents need to act onchain
        </h2>
      </motion.div>

      <div className="flex flex-col border-b border-white/10">
        {useCases.map((useCase, index) => (
          <UseCaseRow index={index} key={useCase.key} useCase={useCase} />
        ))}
      </div>
    </motion.section>
  );
};
