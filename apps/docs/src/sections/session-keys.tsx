import { CheckIcon, ShieldCheckIcon } from "@phosphor-icons/react";

type PolicyTableRow = {
  key: string;
  name: string;
  description: string;
  useCase: string;
};

const policyTable: PolicyTableRow[] = [
  {
    description: "Grants full permissions, equivalent to the primary signer",
    key: "sudo",
    name: "Sudo Policy",
    useCase: "Trusted services or internal automation requiring full control",
  },
  {
    description:
      "Restricts contract calls to specific targets, functions, and parameters",
    key: "call",
    name: "Call Policy",
    useCase: "Most common — limits which contracts and functions can be called",
  },
  {
    description: "Caps total gas usage for a session key",
    key: "gas",
    name: "Gas Policy",
    useCase: "Budgeting and preventing runaway automation",
  },
  {
    description: "Restricts which messages can be signed",
    key: "signature",
    name: "Signature Policy",
    useCase: "Offchain approvals or typed-data signatures",
  },
  {
    description: "Limits how frequently UserOps can be sent",
    key: "rate",
    name: "Rate Limit Policy",
    useCase: "Subscriptions or usage throttling",
  },
  {
    description: "Restricts when a session key is valid",
    key: "timestamp",
    name: "Timestamp Policy",
    useCase: "Time-boxed access, campaign windows",
  },
];

type PolicyRow = {
  enforced?: boolean;
  label: string;
  last?: boolean;
  value: string;
};

const policyRows: PolicyRow[] = [
  { label: "Contracts", value: "[Uniswap Router, USDC]" },
  { label: "Functions", value: "[swap(), transfer()]" },
  { label: "Gas limit", value: "0.01 ETH per tx" },
  { label: "Rate limit", value: "10 tx / hour" },
  { label: "Expires", value: "24h from now" },
  { enforced: true, label: "Enforced", last: true, value: "Onchain" },
];

const PolicyCard = () => {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c0d] backdrop-blur-sm"
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.02), 0 20px 60px -20px rgba(0,0,0,0.8)",
      }}
    >
      {/* Top accent */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)",
        }}
      />
      {/* Glow */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#d6fe51]/10 blur-3xl"
      />

      {/* Terminal header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          session-key.policy
        </span>
      </div>

      <div className="relative flex flex-col gap-3 px-5 py-6 font-mono text-sm">
        <div className="flex items-center gap-2 pb-2">
          <span className="text-white/40">$</span>
          <span className="text-white/70">Session Key Policy</span>
        </div>
        {policyRows.map((row) => (
          <div
            className="flex items-baseline gap-2 leading-relaxed"
            key={row.label}
          >
            <span className="text-white/25">{row.last ? "└──" : "├──"}</span>
            <span className="w-24 text-white/50">{row.label}</span>
            <span className="text-white/30">→</span>
            {row.enforced ? (
              <span className="inline-flex items-center gap-1.5 text-white/85">
                {row.value}
                <CheckIcon className="size-3.5" weight="bold" />
              </span>
            ) : (
              <span className="text-white/80">{row.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const PolicyTable = () => {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c0d] backdrop-blur-sm"
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.02), 0 20px 60px -20px rgba(0,0,0,0.8)",
      }}
    >
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)",
        }}
      />
      <div
        aria-hidden={true}
        className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-white/[0.05] blur-3xl"
      />

      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheckIcon
            className="size-3.5 text-white/45"
            weight="duotone"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
            policy-primitives.table
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1.4fr_1.4fr] border-b border-white/10 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-white/55">
          Policy Type
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-white/55">
          Description
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-white/55">
          Use Case
        </span>
      </div>
      {policyTable.map((row, i) => (
        <div
          className={`grid grid-cols-[1fr_1.4fr_1.4fr] px-5 py-4 gap-4 ${i < policyTable.length - 1 ? "border-b border-white/[0.06]" : ""}`}
          key={row.key}
        >
          <span className="text-sm font-semibold text-white/88">
            {row.name}
          </span>
          <span className="text-sm leading-relaxed text-white/52">
            {row.description}
          </span>
          <span className="text-sm leading-relaxed text-white/42">
            {row.useCase}
          </span>
        </div>
      ))}
    </div>
  );
};

export const SessionKeys = () => {
  return (
    <section
      className="relative mx-auto flex max-w-7xl flex-col gap-14 px-4 py-[12dvh]"
      id="session-keys"
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
        className="pointer-events-none absolute inset-x-0 top-1/4 mx-auto h-96 max-w-4xl blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 30% 50%, rgba(255,255,255,0.05), transparent 70%), radial-gradient(ellipse 40% 50% at 80% 50%, rgba(255,255,255,0.04), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-4">
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          Session Keys & Policies
        </p>
        <h2 className="heading-gradient mx-auto max-w-3xl pb-2 text-center text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Fine-grained control.
          <br />
          Enforced onchain.
        </h2>
      </div>

      <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.6fr] lg:items-start">
        <PolicyCard />
        <PolicyTable />
      </div>
    </section>
  );
};
