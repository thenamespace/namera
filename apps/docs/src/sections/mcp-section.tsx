import { CheckIcon, TerminalIcon, XIcon } from "@phosphor-icons/react";

const mcpLogos = [
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKtNwsHTzwqThfYg1GOo5Myv3QZamde6lH9EJk",
    title: "Claude Code",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKFhrtDaKVboBCWguHlNkJpxPhrQR4i3qvXm1n",
    title: "OpenAI",
  },
];

const canDo = [
  "Execute transactions within policy",
  "Check balances and account state",
  "Issue scoped session keys",
  "Estimate gas before signing",
];

const cannotDo = [
  "Access the main private key",
  "Exceed configured policy limits",
  "Act outside allowed contracts",
  "Override expiry or rate limits",
];

const CommandBlock = () => {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/10 bg-[#08090a]"
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
            "linear-gradient(90deg, transparent, rgba(167,139,250,0.4), transparent)",
        }}
      />
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <TerminalIcon className="size-4 text-white/40" weight="duotone" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            terminal
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </div>
      </div>
      <div className="flex flex-col gap-2 px-5 py-5 font-mono text-sm leading-relaxed">
        <div className="flex items-start gap-2">
          <span className="select-none text-violet-400">$</span>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-white">namera</span>
            <span className="text-violet-400">mcp start</span>
            <span className="text-white/50">--account</span>
            <span className="text-[#b6d6ff]">{"<address>"}</span>
            <span className="text-white/50">--session-key</span>
            <span className="text-[#ffa16c]">{"<key>"}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-white/40">
          <span className="size-1.5 animate-pulse rounded-full bg-violet-400" />
          <span>MCP server listening · stdio transport</span>
        </div>
      </div>
    </div>
  );
};

export const McpSection = () => {
  return (
    <section className="relative px-4 py-[6dvh] sm:py-[8dvh]" id="mcp">
      <div className="relative mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0F1011] p-6 sm:p-10 md:p-14">
          {/* Grid overlay */}
          <div
            aria-hidden={true}
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 80%)",
            }}
          />
          {/* Ambient glow */}
          <div
            aria-hidden={true}
            className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[32rem] -translate-x-1/2 blur-3xl opacity-40"
            style={{
              background:
                "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(167,139,250,0.18), transparent 70%)",
            }}
          />

          <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                  Model Context Protocol
                </p>
                <h2 className="heading-gradient pb-2 text-3xl tracking-tight sm:text-4xl md:text-5xl">
                  Give your agent a wallet in{" "}
                  <span className="text-violet-400">one command</span>.
                </h2>
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  Namera ships a local MCP server. Drop it into Claude, GPT, or
                  any MCP-compatible agent — your model gets wallet capabilities
                  within scoped policies.
                </p>
              </div>

              <CommandBlock />

              <div className="flex flex-col gap-3 pt-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
                  Works with
                </span>
                <div className="flex items-center gap-3">
                  {mcpLogos.map((logo) => (
                    <div
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                      key={logo.title}
                    >
                      <img
                        alt={logo.title}
                        className="size-4 rounded-sm"
                        src={logo.src}
                      />
                      <span>{logo.title}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/50">
                    + any MCP client
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* CAN do */}
              <div
                className="relative flex flex-col gap-4 rounded-2xl border border-violet-400/20 bg-violet-400/[0.03] p-5 backdrop-blur-sm"
                style={{ boxShadow: "inset 0 1px 0 rgba(167,139,250,0.08)" }}
              >
                <div
                  aria-hidden={true}
                  className="pointer-events-none absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-violet-400/10 blur-3xl"
                />
                <div className="relative flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-full border border-violet-400/40 bg-violet-400/15 text-violet-400">
                    <CheckIcon className="size-3" weight="bold" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-violet-400">
                    Agent can
                  </span>
                </div>
                <ul className="relative flex flex-col gap-2.5 text-sm text-white/80">
                  {canDo.map((item) => (
                    <li
                      className="flex items-start gap-2 leading-relaxed"
                      key={item}
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-violet-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CANNOT do */}
              <div
                className="relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}
              >
                <div className="relative flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white/60">
                    <XIcon className="size-3" weight="bold" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">
                    Agent cannot
                  </span>
                </div>
                <ul className="relative flex flex-col gap-2.5 text-sm text-white/60">
                  {cannotDo.map((item) => (
                    <li
                      className="flex items-start gap-2 leading-relaxed"
                      key={item}
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-white/30" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
