import { BrainIcon, LightningIcon, PlugsIcon } from "@phosphor-icons/react";

type UseCase = {
  description: string;
  icon: typeof BrainIcon;
  key: string;
  title: string;
};

const useCases: UseCase[] = [
  {
    description:
      "Give your LLM a wallet it can use. Scoped access, zero key exposure.",
    icon: BrainIcon,
    key: "agents",
    title: "AI Agent Developers",
  },
  {
    description:
      "Automate swaps, positions, and yield strategies with onchain risk rules.",
    icon: LightningIcon,
    key: "defi",
    title: "DeFi Automation",
  },
  {
    description:
      "Let users delegate limited wallet access. Passkeys, batching, and multi-chain included.",
    icon: PlugsIcon,
    key: "protocols",
    title: "Protocol Integrators",
  },
];

const UseCaseCard = ({ useCase }: { useCase: UseCase }) => {
  const Icon = useCase.icon;
  return (
    <div
      className="group relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300"
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
      {/* Hover glow */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute top-6 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full opacity-0 blur-2xl"
        style={{ backgroundColor: "rgba(255,255,255,0.45)" }}
      />

      <div className="relative flex items-start justify-between">
        <div
          className="flex size-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"
          style={{ boxShadow: "0 0 24px rgba(255,255,255,0.06)" }}
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
      className="relative mx-auto flex max-w-7xl flex-col gap-14 px-4 py-[12dvh]"
      id="use-cases"
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
        className="pointer-events-none absolute inset-x-0 top-20 mx-auto h-64 max-w-4xl blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(255,255,255,0.05), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-3">
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          Use Cases
        </p>
        <h2 className="heading-gradient mx-auto max-w-3xl pb-2 text-center text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Built for builders who move onchain.
        </h2>
      </div>

      <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
        {useCases.map((useCase) => (
          <UseCaseCard key={useCase.key} useCase={useCase} />
        ))}
      </div>
    </section>
  );
};
