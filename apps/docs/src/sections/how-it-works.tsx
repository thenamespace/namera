import {
  KeyIcon,
  LightningIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "@phosphor-icons/react";

type Step = {
  description: string;
  icon: typeof WalletIcon;
  key: string;
  label: string;
  title: string;
};

const steps: Step[] = [
  {
    description:
      "Deterministic address, ready on demand. Fund and receive before deployment.",
    icon: WalletIcon,
    key: "create",
    label: "Smart Account",
    title: "Create a Smart Account",
  },
  {
    description:
      "Issue scoped session keys to your agents. The root key stays on your device.",
    icon: KeyIcon,
    key: "session",
    label: "Session Key",
    title: "Define a Session Key",
  },
  {
    description:
      "Restrict contracts, functions, gas, rate, and time windows with one policy layer.",
    icon: ShieldCheckIcon,
    key: "policies",
    label: "Policies",
    title: "Set Policies",
  },
  {
    description:
      "Your agent signs and sends transactions only within the scope you define.",
    icon: LightningIcon,
    key: "execute",
    label: "Execution",
    title: "Agent Executes",
  },
];

const StepCard = ({ step, index }: { step: Step; index: number }) => {
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  return (
    <div className="relative flex flex-col">
      {/* Connector line to next step (desktop only) */}
      {!isLast && (
        <div
          aria-hidden={true}
          className="pointer-events-none absolute top-8 left-[calc(50%+2rem)] hidden h-px w-[calc(100%-4rem)] md:block"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.2) 100%)",
          }}
        />
      )}

      <div
        className="group relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.02), 0 8px 24px -12px rgba(0,0,0,0.6)",
        }}
      >
        {/* Top accent */}
        <div
          aria-hidden={true}
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
          }}
        />
        {/* Glow on hover */}
        <div
          aria-hidden={true}
          className="pointer-events-none absolute top-6 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full opacity-0 blur-2xl"
          style={{ backgroundColor: "rgba(255,255,255,0.45)" }}
        />
        <span
          aria-hidden={true}
          className="pointer-events-none absolute right-5 bottom-4 font-mono text-5xl leading-none text-white/[0.05]"
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="flex items-start">
          <div
            className="flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"
            style={{ boxShadow: "0 0 20px rgba(255,255,255,0.06)" }}
          >
            <Icon className="size-6 text-white/80" weight="duotone" />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
            {step.label}
          </span>
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {step.title}
          </h3>
          <p className="min-h-[4.5rem] max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>
        </div>
      </div>
    </div>
  );
};

export const HowItWorks = () => {
  return (
    <section
      className="relative mx-auto flex max-w-7xl flex-col gap-16 px-4 py-[12dvh]"
      id="how-it-works"
    >
      {/* Top divider */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
        }}
      />
      {/* Ambient glow */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-20 mx-auto h-64 max-w-3xl blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,255,255,0.06), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-3">
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          How It Works
        </p>
        <h2 className="heading-gradient mx-auto max-w-3xl pb-2 text-center text-3xl tracking-tight sm:text-4xl md:text-5xl">
          From smart account to agent execution
        </h2>
      </div>

      <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
        {steps.map((step, i) => (
          <StepCard index={i} key={step.key} step={step} />
        ))}
      </div>
    </section>
  );
};
