import { buttonVariants } from "@namera-ai/ui/components/ui/button";
import { cn } from "@namera-ai/ui/lib/utils";
import { CheckIcon, XIcon } from "@phosphor-icons/react";

import { AmbientGlow, GridOverlay } from "@/components/misc";

const mcpLogos = [
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKtNwsHTzwqThfYg1GOo5Myv3QZamde6lH9EJk",
    title: "Claude Code",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcK3dqLdjsgdt63Nik9WJIYpTSPrqZ450EzjOwy",
    title: "Codex",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKdNRRVjgMW1XVhHYwxBtyD6dpfPmUzgKbuGRs",
    title: "Cursor",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKJfd1B4xymWqpiVhRKblN4Z9vFextaPOX0kDr",
    title: "OpenCode",
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
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
        }}
      />
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-yellow-400" />
          <span className="size-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-geist-mono text-[10px] uppercase pt-px">
            MCP Server
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-5 py-5 font-mono text-sm leading-relaxed">
        <div className="flex items-start gap-2">
          <span className="select-none text-muted-foreground">$</span>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[#4cde9a]">namera</span>
            <span className="text-[#e6a871]">mcp start</span>
            <span className="text-muted-foreground">--sa</span>
            <span className="text-[#b6d6ff]">my-account</span>
            <span className="text-muted-foreground">--transport</span>
            <span className="text-[#b6d6ff]">stdio</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
          <span>MCP server listening · stdio transport</span>
        </div>
      </div>
    </div>
  );
};

export const McpSection = () => {
  return (
    <section
      className="relative px-4 py-[6dvh] sm:py-[8dvh] min-h-screen justify-center border items-center flex"
      id="mcp"
    >
      <div className="relative mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0F1011] p-6 sm:p-10 md:p-14">
          <GridOverlay />
          <AmbientGlow />
          <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                  Model Context Protocol
                </p>
                <h2 className="heading-gradient pb-2 text-3xl tracking-tight sm:text-4xl md:text-5xl">
                  Give your agent a wallet in one command
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
                <div className="flex items-center gap-3 overflow-scroll no-scrollbar">
                  {mcpLogos.map((logo) => (
                    <div
                      className={cn(buttonVariants({ variant: "outline" }))}
                      key={logo.title}
                    >
                      <img
                        alt={logo.title}
                        className="size-4 rounded-sm"
                        src={logo.src}
                        title={logo.title}
                      />
                      <span>{logo.title}</span>
                    </div>
                  ))}
                  <div className="block text-nowrap text-sm text-muted-foreground">
                    and more
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* CAN do */}
              <div
                className="relative flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/3 p-5 backdrop-blur-sm"
                style={{ boxShadow: "inset 0 1px 0 rgba(167,139,250,0.08)" }}
              >
                <div
                  aria-hidden={true}
                  className="pointer-events-none absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
                />
                <div className="relative flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary">
                    <CheckIcon className="size-3" weight="bold" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                    Agent can
                  </span>
                </div>
                <ul className="relative flex flex-col gap-2.5 text-sm text-white/80">
                  {canDo.map((item) => (
                    <li
                      className="flex items-start gap-2 leading-relaxed"
                      key={item}
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CANNOT do */}
              <div
                className="relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/2 p-5 backdrop-blur-sm"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}
              >
                <div className="relative flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60">
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
