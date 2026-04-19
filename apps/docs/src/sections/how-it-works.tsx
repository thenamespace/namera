import { useRef } from "react";

import {
  type Icon,
  KeyIcon,
  LightningIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import {
  type MotionValue,
  motion,
  useScroll,
  useTransform,
} from "motion/react";

import { Hr } from "@/components";

type Step = {
  description: string;
  icon: Icon;
  key: string;
  label: string;
  title: string;
  color: string;
};

const steps: Step[] = [
  {
    color: "#ffa16c",
    description:
      "Deterministic address, ready on demand. Fund and receive before deployment.",
    icon: WalletIcon,
    key: "create",
    label: "Smart Account",
    title: "Create a Smart Account",
  },
  {
    color: "#b6d6ff",
    description:
      "Issue scoped session keys to your agents. The root key stays on your device.",
    icon: KeyIcon,
    key: "session",
    label: "Session Key",
    title: "Define a Session Key",
  },
  {
    color: "#d6fe51",
    description:
      "Restrict contracts, functions, gas, rate, and time windows with one policy layer.",
    icon: ShieldCheckIcon,
    key: "policies",
    label: "Policies",
    title: "Set Policies",
  },
  {
    color: "#ffa16c",
    description:
      "Your agent signs and sends transactions only within the scope you define.",
    icon: LightningIcon,
    key: "execute",
    label: "Execution",
    title: "Agent Executes",
  },
];

const StepCard = ({
  step,
  index,
  scrollYProgress,
}: {
  step: Step;
  index: number;
  scrollYProgress: MotionValue<number>;
}) => {
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  // --- Scroll Scrubbing Math ---
  const segment = 1 / steps.length;
  const start = index * segment;
  const cardFadeEnd = start + 0.1;
  const glowEnd = cardFadeEnd + 0.05;
  const lineEnd = start + segment;

  // --- EXPLICIT Motion Transforms ---
  // Format: [0 (start of page), start of animation, end of animation, 1 (end of page)]

  const cardOpacity = useTransform(
    scrollYProgress,
    [0, start, cardFadeEnd, 1],
    [0, 0, 1, 1], // Locked at 1 until the end
  );

  const cardY = useTransform(
    scrollYProgress,
    [0, start, cardFadeEnd, 1],
    [40, 40, 0, 0], // Locked at 0 until the end
  );

  const lineScaleX = useTransform(
    scrollYProgress,
    [0, cardFadeEnd, lineEnd, 1],
    [0, 0, 1, 1],
  );

  const numberGlowOpacity = useTransform(
    scrollYProgress,
    [0, cardFadeEnd, glowEnd, 1],
    [0, 0, 1, 1],
  );

  const borderGlowOpacity = useTransform(
    scrollYProgress,
    [0, cardFadeEnd, glowEnd, 1],
    [0.02, 0.02, 0.15, 0.15],
  );

  const iconBorderColor = useTransform(
    scrollYProgress,
    [0, cardFadeEnd, glowEnd, 1],
    [
      "rgba(255,255,255,0.1)",
      "rgba(255,255,255,0.1)",
      "rgba(255,255,255,0.3)",
      "rgba(255,255,255,0.3)",
    ],
  );

  const iconColor = useTransform(
    scrollYProgress,
    [0, cardFadeEnd, glowEnd, 1],
    [
      "rgba(255,255,255,0.4)",
      "rgba(255,255,255,0.4)",
      "rgba(255,255,255,1)",
      "rgba(255,255,255,1)",
    ],
  );

  const titleColor = useTransform(
    scrollYProgress,
    [0, cardFadeEnd, glowEnd, 1],
    [
      "rgba(255,255,255,0.6)",
      "rgba(255,255,255,0.6)",
      "rgba(255,255,255,1)",
      "rgba(255,255,255,1)",
    ],
  );

  return (
    <motion.div
      className="relative flex flex-col"
      style={{ opacity: cardOpacity, y: cardY }}
    >
      {/* Energy Connector Line */}
      {!isLast && (
        <motion.div
          className="pointer-events-none absolute top-8 left-[calc(50%+2rem)] hidden h-[2px] w-[calc(100%-4rem)] origin-left md:block"
          style={{ scaleX: lineScaleX }}
        >
          <div className="absolute inset-0 bg-white/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
        </motion.div>
      )}

      {/* Card Body */}
      <motion.div
        className="group relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
        style={{
          boxShadow: "0 8px 24px -12px rgba(0,0,0,0.6)",
        }}
      >
        {/* Top accent */}
        <motion.div
          aria-hidden={true}
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ opacity: borderGlowOpacity }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
        </motion.div>

        {/* Number Layering */}
        <div className="absolute right-5 top-4">
          <span className="font-mono text-5xl leading-none text-white/[0.05]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <motion.span
            className="absolute inset-0 font-mono text-5xl leading-none text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]"
            style={{ opacity: numberGlowOpacity }}
          >
            {String(index + 1).padStart(2, "0")}
          </motion.span>
        </div>

        {/* Icon */}
        <div className="flex items-start relative z-10">
          <motion.div
            className="flex size-12 items-center justify-center rounded-xl border bg-white/[0.03]"
            style={{ borderColor: iconBorderColor }}
          >
            <motion.div style={{ color: iconColor }}>
              <Icon className="size-6" weight="duotone" />
            </motion.div>
          </motion.div>
        </div>

        {/* Text */}
        <div className="flex flex-1 flex-col gap-2 relative z-10">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
            {step.label}
          </span>
          <motion.h3
            className="text-lg font-semibold tracking-tight"
            style={{ color: titleColor }}
          >
            {step.title}
          </motion.h3>
          <p className="min-h-[4.5rem] max-w-[26ch] text-sm leading-relaxed text-white/50">
            {step.description}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const HowItWorks = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    offset: ["start start", "end end"],
    target: containerRef,
  });

  return (
    <section
      className="relative h-[400dvh]"
      id="how-it-works"
      ref={containerRef}
    >
      <Hr />
      <div className="sticky top-0 flex h-dvh w-full flex-col items-center justify-center px-4 max-w-7xl mx-auto gap-24">
        <div className="flex flex-col gap-3">
          <p className="text-center text-xs font-medium uppercase text-muted-foreground tracking-wider">
            How It Works
          </p>
          <h2 className="heading-gradient mx-auto max-w-3xl pb-2 text-center text-3xl tracking-tight text-white sm:text-4xl md:text-5xl">
            From smart account to agent execution
          </h2>
        </div>
        <div className="relative grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
          {steps.map((step, i) => (
            <StepCard
              index={i}
              key={step.key}
              scrollYProgress={scrollYProgress}
              step={step}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
