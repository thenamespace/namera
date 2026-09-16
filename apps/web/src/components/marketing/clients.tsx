import { BrandClaudeIcon, BrandMcpIcon, BrandOpenaiIcon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { Container, Reveal, Section, SectionIntro } from "#/components/marketing/primitives";

/* -------------------------------------------------------------------------
 * Every client gets its own grant.
 *
 * Commands come from apps/cli/README.md, not from imagination. The MCP is a
 * local stdio server the client launches — `namera mcp serve` — so there is no
 * hosted URL to paste and no `--transport http` anywhere on this page.
 *
 * The three cards carry the partner's own colour, which is the only saturated
 * colour on the site. The mark is a slot: drop the real SVG into
 * `packages/ui/src/icons/brand/` and swap the placeholder in MARKS below.
 * ---------------------------------------------------------------------- */

/*
 * The code block is cut off by the card rather than wrapped inside it: it bleeds
 * past the right padding and fades out, which is what makes a card read as a
 * window onto a terminal instead of a screenshot of one.
 */
const FADE = "linear-gradient(to right,#000 0%,#000 84%,transparent 100%)";

type Token = readonly [text: string, kind: "cmd" | "flag" | "arg" | "punct"];

const Command = ({
  label,
  lines,
  light,
}: {
  readonly label: string;
  readonly lines: readonly (readonly Token[])[];
  readonly light: boolean;
}) => (
  <code
    className={cn(
      "type-mono block text-[0.75rem] leading-[2]",
      light ? "text-[#3d4250]" : "text-white/70",
    )}
    style={{ maskImage: FADE, WebkitMaskImage: FADE }}
  >
    <span className={cn("block", light ? "text-[#14161c]" : "text-white")}>{label}</span>
    <span className="block">&nbsp;</span>
    {lines.map((line) => (
      <span key={JSON.stringify(line)} className="block whitespace-nowrap">
        {line.length === 0 ? "\u00a0" : null}
        {line.map(([text, kind], index) => (
          <span
            key={`${text}-${String(index)}`}
            className={cn(
              kind === "cmd" && (light ? "font-medium text-[#14161c]" : "text-white"),
              kind === "arg" && (light ? "text-[#4a4fd0]" : "text-white/90"),
              kind === "flag" && (light ? "text-[#6b7180]" : "text-white/55"),
            )}
          >
            {text}
            {index < line.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    ))}
  </code>
);

const CLIENTS = [
  {
    name: "Claude Code",
    mark: BrandClaudeIcon,
    light: false,
    surface: "linear-gradient(180deg,#cb7d5f 0%,#bd6d51 100%)",
    markColor: "#ffffff",
    body: "Register once. The client starts Namera when it needs it, and every tool call runs inside the session key's limits.",
    lines: [
      [
        ["claude mcp add", "cmd"],
        ["--transport stdio", "flag"],
        ["--scope user", "flag"],
      ],
      [
        ["namera", "arg"],
        ["--", "flag"],
        ["namera mcp serve", "cmd"],
        ["--profile claude", "flag"],
      ],
    ],
  },
  {
    name: "Codex",
    mark: BrandOpenaiIcon,
    light: true,
    surface: "linear-gradient(180deg,#dbe6f7 0%,#ddd8f4 100%)",
    markColor: "#14161c",
    body: "The same server under its own profile. Signing in to one client does not authorize another.",
    lines: [
      [
        ["codex mcp add", "cmd"],
        ["namera", "arg"],
        ["--", "flag"],
      ],
      [
        ["namera mcp serve", "cmd"],
        ["--profile codex", "flag"],
      ],
    ],
  },
  {
    name: "Any MCP client",
    mark: BrandMcpIcon,
    light: true,
    surface: "#ffffff",
    markColor: "#14161c",
    body: "Point any client at the namera binary. No hosted server, no port to open, and no secret to paste.",
    lines: null,
  },
] as const;

export const Clients = () => (
  <Section id="clients" className="border-t-1 border-border">
    <Container>
      <Reveal>
        <SectionIntro title="Every client gets its own grant">
          Register Namera once in the client you already use. Each one authorizes separately, keeps
          its credentials in your OS keyring, and can be cut off on its own.
        </SectionIntro>
      </Reveal>

      <Reveal delay={0.06} className="mt-14 md:mt-20">
        <div className="grid gap-4 md:grid-cols-3">
          {CLIENTS.map((client) => (
            <div
              key={client.name}
              className="relative flex min-h-[30rem] flex-col justify-between overflow-hidden rounded-lg p-6 sm:min-h-[36rem] sm:p-8"
              style={{ background: client.surface }}
            >
              <client.mark
                aria-hidden
                className="size-7 shrink-0"
                style={{ color: client.markColor }}
              />

              {/* the fragment: what you actually paste */}
              <div className="my-8 flex flex-1 items-center">
                {client.lines ? (
                  <div
                    className={cn(
                      "-mr-6 w-[calc(100%+1.5rem)] overflow-hidden rounded-l-md border-1 border-r-0 px-4 py-4",
                      "sm:-mr-8 sm:w-[calc(100%+2rem)]",
                      client.light ? "border-black/8 bg-white/70" : "border-white/20 bg-white/10",
                    )}
                  >
                    <Command label={client.name} lines={client.lines} light={client.light} />
                  </div>
                ) : (
                  <div
                    className={
                      cn(
                        "-mr-6 w-[calc(100%+1.5rem)] overflow-hidden rounded-l-md bg-[#121316] px-4 py-4",
                        "shadow-[0_18px_40px_-24px_rgb(0_0_0/0.6)] sm:-mr-8 sm:w-[calc(100%+2rem)]",
                      ) ?? ""
                    }
                  >
                    <code
                      className="type-mono block text-[0.75rem] leading-[2] whitespace-nowrap text-white/70"
                      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
                    >
                      <span className="block text-white">Any MCP client</span>
                      <span className="block">&nbsp;</span>
                      <span className="text-white/45">{"{"}</span>
                      <br />
                      <span className="pl-3 text-white/80">&quot;command&quot;</span>
                      <span className="text-white/45">: </span>
                      <span className="text-[#9aa4ff]">&quot;namera&quot;</span>
                      <span className="text-white/45">,</span>
                      <br />
                      <span className="pl-3 text-white/80">&quot;args&quot;</span>
                      <span className="text-white/45">: </span>
                      <span className="text-[#9aa4ff]">
                        [&quot;mcp&quot;, &quot;serve&quot;, &quot;--profile&quot;,
                        &quot;agent&quot;]
                      </span>
                      <br />
                      <span className="text-white/45">{"}"}</span>
                    </code>
                  </div>
                )}
              </div>

              <div>
                <p
                  className={cn(
                    "text-[0.9375rem] font-medium",
                    client.light ? "text-[#14161c]" : "text-white",
                  )}
                >
                  {client.name}
                </p>
                <p
                  className={cn(
                    "mt-2 max-w-[34ch] text-[0.9375rem] leading-[1.6]",
                    client.light ? "text-[#4d5260]" : "text-white/70",
                  )}
                >
                  {client.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.12} className="mt-10">
        <p className="mx-auto max-w-[70ch] text-center text-[0.9375rem] leading-[1.7] text-muted">
          Each profile keeps its own grant in the OS keyring.{" "}
          <code className="type-mono text-[0.8125rem] text-foreground">
            namera mcp logout --profile codex
          </code>{" "}
          revokes that one on the server and leaves your other profiles, and your signing keys,
          exactly as they were.
        </p>
      </Reveal>
    </Container>
  </Section>
);
