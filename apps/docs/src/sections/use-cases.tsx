import {
  type BrainIcon,
  ClockCountdownIcon,
  CpuIcon,
  GaugeIcon,
  KeyIcon,
  RepeatIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";

import { Hr } from "@/components";
import { AmbientGlow } from "@/components/misc";

type UseCase = {
  description: string;
  icon: typeof BrainIcon;
  key: string;
  title: string;
};

const useCases: UseCase[] = [
  {
    description:
      "Enforce rules onchain limiting contracts calls, gas usage, and more.",
    icon: ShieldCheckIcon,
    key: "",
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
    description: "Enable recurring payments for services and memberships.",
    icon: RepeatIcon,
    key: "subscriptions",
    title: "Subscriptions",
  },
  {
    description: "Enable autonomous systems to exchange value continuously.",
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
    description: "Restrict wallet actions to specific time windows.",
    icon: ClockCountdownIcon,
    key: "time-locked-spending",
    title: "Time-Locked Spending",
  },
];

const UseCaseCard = ({ useCase }: { useCase: UseCase }) => {
  const Icon = useCase.icon;
  return (
    <div
      className="group relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-white/10 bg-white/2 p-6 backdrop-blur-sm transition-all duration-300"
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
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
        }}
      />
      {/* Hover glow */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute top-6 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full opacity-0 blur-2xl"
        style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
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
          {useCase.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {useCase.description}
        </p>
      </div>
    </div>
  );
};

export const UseCases = () => {
  return (
    <section
      className="relative mx-auto flex max-w-7xl flex-col gap-14 px-4 py-[12dvh] min-h-screen items-center justify-center"
      id="use-cases"
    >
      <Hr />
      <AmbientGlow />
      <div className="relative flex flex-col gap-3">
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          Use Cases
        </p>
        <h2 className="heading-gradient mx-auto max-w-3xl pb-2 text-center text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Built for builders who move onchain.
        </h2>
      </div>

      <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {useCases.map((useCase) => (
          <UseCaseCard key={useCase.key} useCase={useCase} />
        ))}
      </div>
    </section>
  );
};
