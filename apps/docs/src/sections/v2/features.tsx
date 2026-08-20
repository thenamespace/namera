import {
  ArrowsClockwiseIcon,
  ClockCountdownIcon,
  GaugeIcon,
  ListChecksIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  type WalletIcon,
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
      "Define exactly what an agent can do: which contracts, which methods, how much, and how often.",
    icon: ShieldCheckIcon,
    key: "scoped",
    title: "Scoped Permissions",
  },
  {
    description:
      "Hard caps per transaction, per day, and per token. The agent can never drain the wallet.",
    icon: GaugeIcon,
    key: "spend-limits",
    title: "Spend Limits",
  },
  {
    description:
      "Agents can only touch approved contracts and functions. Everything else reverts.",
    icon: LockKeyIcon,
    key: "allowlists",
    title: "Contract Allowlists",
  },
  {
    description:
      "Throttle how frequently an agent can act and set expiry windows so access is never open-ended.",
    icon: ClockCountdownIcon,
    key: "rate-expiry",
    title: "Rate Limits & Expiry",
  },
  {
    description:
      "Revoke a key the moment something looks wrong, with no impact on the primary wallet or other agents.",
    icon: ArrowsClockwiseIcon,
    key: "revoke",
    title: "Instant Revocation",
  },
  {
    description:
      "Every permission and action is auditable. Policies live onchain and can't be bypassed by the agent.",
    icon: ListChecksIcon,
    key: "audit",
    title: "Monitor & Audit",
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
          Agent Permissions API
        </p>
        <h2 className="heading-gradient mx-auto max-w-3xl pb-2 text-center text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Define, issue, monitor, revoke
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
