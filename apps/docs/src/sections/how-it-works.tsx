import { motion, type Variants } from "motion/react";

import { AmbientGlow, Hr } from "@/components/misc";

type Step = {
  description: string;
  key: string;
  title: string;
};

const steps: Step[] = [
  {
    description:
      "An agent needs to call a paid API, execute a trade, or pay a subscription.",
    key: "wants",
    title: "Agent wants to pay",
  },
  {
    description:
      "You set spend caps, allowed contracts, rate limits, and an expiry window.",
    key: "limits",
    title: "You define limits",
  },
  {
    description:
      "Namera mints a revocable session key bound to exactly that policy.",
    key: "key",
    title: "Namera issues a scoped key",
  },
  {
    description:
      "It transacts freely and autonomously, but only inside the boundaries.",
    key: "acts",
    title: "Agent acts within policy",
  },
  {
    description:
      "Overspend, wrong contract, or expired key. The transaction reverts onchain.",
    key: "fails",
    title: "Anything outside fails",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.1, staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    y: 0,
  },
};

export const HowItWorks = () => {
  return (
    <motion.section
      className="relative mx-auto flex max-w-7xl flex-col gap-14 px-4 py-[12dvh]"
      id="how-it-works"
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
          How it works
        </p>
        <h2 className="heading-gradient mx-auto max-w-2xl pb-2 text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Autonomous execution.
          <br />
          Human-defined limits.
        </h2>
      </motion.div>

      <div className="relative grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, i) => (
          <motion.div
            className="group relative flex flex-col gap-4 bg-[#08090a] p-6"
            key={step.key}
            variants={itemVariants}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] font-geist-mono text-xs text-white/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              {i < steps.length - 1 && (
                <div
                  aria-hidden={true}
                  className="hidden h-px flex-1 bg-linear-to-r from-white/15 to-transparent lg:block"
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-white">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};
