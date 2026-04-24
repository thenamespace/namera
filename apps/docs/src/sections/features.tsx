import {
  GlobeIcon,
  KeyIcon,
  LockSimpleIcon,
  ShieldCheckIcon,
  StackIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { motion, type Variants } from "motion/react";

import { AmbientGlow, Hr } from "@/components/misc";

type Feature = {
  description: string;
  icon: typeof WalletIcon;
  key: string;
  title: string;
};

const features: Feature[] = [
  {
    description:
      "Wallets that behave like programmable execution environments, not static key holders.",
    icon: WalletIcon,
    key: "smart-accounts",
    title: "Smart Accounts",
  },
  {
    description:
      "Give agents controlled access without ever exposing your primary private key.",
    icon: KeyIcon,
    key: "session-keys",
    title: "Session Keys",
  },
  {
    description:
      "Define spend limits, time windows, and contract rules enforced onchain.",
    icon: ShieldCheckIcon,
    key: "onchain-policies",
    title: "Onchain Policies",
  },
  {
    description:
      "Bundle actions or run them simultaneously, depending on your workflow needs.",
    icon: StackIcon,
    key: "batched",
    title: "Batched & Parallel Transactions",
  },
  {
    description:
      "Execute across any EVM chain from a unified interface without switching wallets.",
    icon: GlobeIcon,
    key: "multi-chain",
    title: "Multi-chain Execution",
  },
  {
    description:
      "You always stay in control. No intermediaries, third parties, or custody tradeoffs.",
    icon: LockSimpleIcon,
    key: "self-custodial",
    title: "Self-custodial",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.15,
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
    y: 0,
  },
};

const FeatureCard = (feature: Feature) => {
  const Icon = feature.icon;
  return (
    <motion.div
      className="group relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-white/10 bg-white/2 p-6 backdrop-blur-sm transition-all duration-300"
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.02), 0 8px 24px -12px rgba(0,0,0,0.6)",
      }}
      variants={itemVariants}
    >
      {/* Top accent */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
        }}
      />

      <div className="relative flex items-start justify-between">
        <div
          className="flex size-14 items-center justify-center rounded-xl border border-white/10 bg-white/3"
          style={{ boxShadow: "0 0 24px rgba(255,255,255,0.02)" }}
        >
          <Icon className="size-7 text-white/80" weight="duotone" />
        </div>
      </div>

      <div className="relative flex flex-col gap-3">
        <h3 className="text-xl font-semibold tracking-tight text-white">
          {feature.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
};

export const Features = () => {
  return (
    <motion.section
      className="relative mx-auto flex max-w-7xl flex-col gap-14 px-4 py-[12dvh]"
      id="features"
      initial="hidden"
      viewport={{ margin: "-100px", once: true }}
      whileInView="visible"
    >
      <Hr />
      <AmbientGlow />

      <motion.div
        className="relative flex flex-col gap-3"
        variants={itemVariants}
      >
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          Features
        </p>
        <h2 className="heading-gradient mx-auto max-w-3xl pb-2 text-center text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Built for agent-native execution
        </h2>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3"
        variants={containerVariants}
      >
        {features.map((feature) => (
          <FeatureCard {...feature} key={feature.key} />
        ))}
      </motion.div>
    </motion.section>
  );
};
