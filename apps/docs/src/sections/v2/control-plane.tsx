import { motion, type Variants } from "motion/react";

import { Hr } from "@/components";

const pillars = [
  {
    color: "#b6d6ff",
    description:
      "Smart wallets and account infra like ZeroDev, Safe, Privy, Turnkey, and Coinbase AgentKit. Bring your own; Namera sits above it.",
    key: "wallets",
    label: "Wallets give agents",
    stat: "Power",
  },
  {
    color: "#ffa16c",
    description:
      "Agentic payment protocols like x402 and MPP let agents pay APIs, services, and each other. Namera bounds them, never replaces them.",
    key: "rails",
    label: "Rails give agents",
    stat: "Reach",
  },
  {
    color: "#d6fe51",
    description:
      "One control plane that defines what every agent is allowed to do: spend caps, allowlists, rate limits, and expiry, across any wallet, any chain.",
    key: "limits",
    label: "Namera gives agents",
    stat: "Limits",
  },
];

const mentalModels = [
  { key: "auth0", note: "for agent wallet permissions", term: "Auth0" },
  { key: "radar", note: "for autonomous payments", term: "Stripe Radar" },
  { key: "oauth", note: "for onchain money movement", term: "OAuth scopes" },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.15, staggerChildren: 0.12 },
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

export const ControlPlane = () => {
  return (
    <motion.section
      className="relative mx-auto flex max-w-7xl flex-col gap-14 px-4 py-[12dvh]"
      id="control-plane"
      initial="hidden"
      variants={containerVariants}
      viewport={{ margin: "-100px", once: true }}
      whileInView="visible"
    >
      <Hr />

      <motion.div
        className="flex flex-col items-center gap-3 text-center"
        variants={itemVariants}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          The control plane
        </p>
        <h2 className="heading-gradient mx-auto max-w-2xl pb-2 text-3xl tracking-tight sm:text-4xl md:text-5xl">
          The permissions layer for agentic money
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {pillars.map((pillar) => (
          <motion.div
            className="group relative flex w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-white/2 backdrop-blur-sm"
            key={pillar.key}
            style={{
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.02), 0 8px 24px -12px rgba(0,0,0,0.6)",
            }}
            variants={itemVariants}
          >
            <div
              aria-hidden={true}
              className="absolute inset-x-0 top-0 h-px opacity-60"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
              }}
            />
            <div className="relative flex h-40 flex-row items-start gap-4 p-6">
              <div
                className="h-16 w-0.5 rounded-full"
                style={{ backgroundColor: pillar.color }}
              />
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
                  {pillar.label}
                </span>
                <span className="text-4xl font-semibold tracking-tight text-white/88">
                  {pillar.stat}
                </span>
              </div>
            </div>
            <div className="relative border-t border-white/10 p-6 text-sm leading-relaxed text-muted-foreground">
              {pillar.description}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="flex flex-col items-center gap-5 pt-2"
        variants={itemVariants}
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/35">
          Think of it as
        </span>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {mentalModels.map((m) => (
            <div
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2"
              key={m.key}
            >
              <span className="text-sm font-semibold text-white/85">
                {m.term}
              </span>
              <span className="text-sm text-muted-foreground">{m.note}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.section>
  );
};
