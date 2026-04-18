import {
  ArrowRightIcon,
  CodeIcon,
  CubeTransparentIcon,
  KeyIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";

type Pillar = {
  description: string;
  icon: typeof ShieldCheckIcon;
  key: string;
  title: string;
};

const pillars: Pillar[] = [
  {
    description: "Your private keys never leave your device.",
    icon: KeyIcon,
    key: "custody",
    title: "No Key Custody",
  },
  {
    description: "Rules live onchain. No server to hack, no rule to bypass.",
    icon: ShieldCheckIcon,
    key: "onchain",
    title: "Onchain Enforcement",
  },
  {
    description: "ZeroDev's audited ERC-4337 account abstraction underneath.",
    icon: CubeTransparentIcon,
    key: "zerodev",
    title: "Built on ZeroDev",
  },
  {
    description: "Read the code, audit it, contribute. No black boxes.",
    icon: CodeIcon,
    key: "oss",
    title: "Open Source",
  },
];

const PillarCard = ({ pillar }: { pillar: Pillar }) => {
  const Icon = pillar.icon;
  return (
    <div
      className="group relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300"
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.02), 0 8px 24px -12px rgba(0,0,0,0.6)",
      }}
    >
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
        }}
      />
      <div
        aria-hidden={true}
        className="pointer-events-none absolute top-6 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full opacity-0 blur-2xl"
        style={{ backgroundColor: "rgba(255,255,255,0.45)" }}
      />

      <div
        className="relative flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"
        style={{ boxShadow: "0 0 20px rgba(255,255,255,0.06)" }}
      >
        <Icon className="size-6 text-white/80" weight="duotone" />
      </div>

      <div className="relative flex flex-col gap-2">
        <h3 className="text-base font-semibold tracking-tight text-white">
          {pillar.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {pillar.description}
        </p>
      </div>
    </div>
  );
};

export const Trust = () => {
  return (
    <section
      className="relative mx-auto flex max-w-7xl flex-col gap-14 px-4 py-[12dvh]"
      id="trust"
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
      {/* Grid overlay */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 50% at 50% 40%, #000 30%, transparent 80%)",
        }}
      />
      {/* Ambient glow */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-20 mx-auto h-64 max-w-3xl blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,255,255,0.06), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-center">
          <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
            Security & Trust
          </p>
        </div>
        <h2 className="heading-gradient mx-auto max-w-3xl pb-2 text-center text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Built on audited infrastructure.
        </h2>
      </div>

      <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map((pillar) => (
          <PillarCard key={pillar.key} pillar={pillar} />
        ))}
      </div>

      <div className="relative flex justify-center">
        <a
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          href="/docs"
        >
          <span>Read our security docs</span>
          <ArrowRightIcon
            className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
            weight="bold"
          />
        </a>
      </div>
    </section>
  );
};
