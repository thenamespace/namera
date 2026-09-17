import { CancelCircleIcon, ComputerTerminal01Icon, Icon, Key01Icon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { Container, Reveal, Section, SectionIntro } from "#/components/marketing/primitives";

/* -------------------------------------------------------------------------
 * Four things the policy stops.
 *
 * One bordered box, quartered. Each quarter carries a small, self-contained
 * picture of the exact moment its two lines describe — a refused over-cap swap,
 * a device approval, a key winding down, one revoked agent among running ones —
 * sitting whole in a fixed frame above the copy, not scaled or clipped. The
 * section is compact so the heading and all four land in a single view.
 * ---------------------------------------------------------------------- */

const Card = ({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string | undefined;
}) => (
  <div
    className={cn(
      "edge-top w-full overflow-hidden rounded-lg border-1 border-hairline-strong",
      "bg-[linear-gradient(168deg,#17181c_0%,#121316_52%,#0d0e11_100%)]",
      className,
    )}
  >
    {children}
  </div>
);

/* -------------------------------- artifacts ------------------------------- */

/** Spends past its cap → a swap that breaks the daily cap, refused. */
const CapArtifact = () => (
  <Card>
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[0.8125rem] font-medium text-foreground">
          Swap 120 USDC for ETH
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">Uniswap Agent</p>
      </div>
      <span className="shrink-0 rounded-md bg-danger/12 px-2 py-1 text-[0.6875rem] font-medium text-danger">
        Refused
      </span>
    </div>
    <div className="border-t-1 border-border px-4 py-3">
      <div className="flex items-center justify-between text-[0.6875rem]">
        <span className="text-ink-subtle">Daily spend</span>
        <span className="tabular-nums text-foreground">120 / 100 USDC</span>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-default">
        <span className="h-full w-[83%] bg-danger" />
        <span className="h-full flex-1 bg-danger/30" />
      </div>
    </div>
  </Card>
);

/** New device asks for access → the CLI request, awaiting your approval. */
const DeviceArtifact = () => (
  <Card>
    <div className="flex items-center gap-2.5 px-4 py-3">
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-md bg-default/70 text-muted"
      >
        <Icon icon={ComputerTerminal01Icon} strokeWidth={1.7} className="size-3.5" />
      </span>
      <p className="text-[0.8125rem] font-medium text-foreground">Namera CLI wants access</p>
    </div>
    <div className="flex items-center justify-between gap-3 border-t-1 border-border px-4 py-2.5">
      <span className="text-[0.6875rem] text-ink-subtle">Verification code</span>
      <span className="type-mono text-[0.75rem] tracking-[0.08em] text-foreground">R77H-3L96</span>
    </div>
    <div className="flex items-center gap-2 px-4 py-3">
      <span className="rounded-md border-1 border-border px-3 py-1.5 text-[0.75rem] text-muted">
        Reject
      </span>
      <span className="rounded-md bg-accent px-3 py-1.5 text-[0.75rem] font-medium text-white">
        Approve
      </span>
    </div>
  </Card>
);

/** Key reaches its expiry → one key counting down to its end date. */
const ExpiryArtifact = () => (
  <Card>
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md bg-[#3a2a52] text-[0.875rem]"
      >
        🦄
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-medium text-foreground">Uniswap Agent</p>
        <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">Expires 27 Sept 2026</p>
      </div>
      <span className="shrink-0 text-[0.75rem] text-muted tabular-nums">12d left</span>
    </div>
    <div className="flex items-center gap-3 border-t-1 border-border px-4 py-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-default">
        <span className="block h-full w-[78%] bg-accent" />
      </div>
      <span className="text-[0.625rem] uppercase tracking-[0.08em] text-ink-subtle">Signing</span>
    </div>
  </Card>
);

const KEYS = [
  { name: "Uniswap Agent", account: "Trading Account", revoked: false },
  { name: "Payouts Agent", account: "Treasury", revoked: true },
  { name: "Research Agent", account: "Trading Account", revoked: false },
] as const;

/** Revoke a single agent → one key cut, the others still active. */
const RevokeArtifact = () => (
  <div className="flex w-full flex-col gap-1">
    {KEYS.map((key) => (
      <Card
        key={key.name}
        className={cn(
          "flex items-center gap-3 px-3.5 py-2",
          key.revoked && "border-danger/30 bg-danger/6",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md",
            key.revoked ? "bg-danger/12 text-danger" : "bg-default/70 text-muted",
          )}
        >
          <Icon
            icon={key.revoked ? CancelCircleIcon : Key01Icon}
            strokeWidth={1.7}
            className="size-3.5"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[0.8125rem]",
              key.revoked ? "text-ink-subtle line-through decoration-danger/50" : "text-foreground",
            )}
          >
            {key.name}
          </span>
          <span className="block truncate text-[0.6875rem] text-ink-subtle">{key.account}</span>
        </span>
        <span
          className={cn("shrink-0 text-[0.6875rem]", key.revoked ? "text-danger" : "text-success")}
        >
          {key.revoked ? "Revoked" : "Active"}
        </span>
      </Card>
    ))}
  </div>
);

/* ---------------------------------- grid ---------------------------------- */

const QUADRANTS = [
  {
    artifact: CapArtifact,
    title: "Spends over its limit",
    body: "The agent tries to spend 120 USDC with a 100 USDC limit. Namera blocks it before execution.",
  },
  {
    artifact: DeviceArtifact,
    title: "Unapproved access",
    body: "A new device can’t use your agent’s credentials until you explicitly approve it.",
  },
  {
    artifact: ExpiryArtifact,
    title: "Expired access",
    body: "When a session key expires, the agent loses access automatically. Renew it or leave it expired.",
  },
  {
    artifact: RevokeArtifact,
    title: "Revoked access",
    body: "Revoke an agent at any time without affecting the others.",
  },
] as const;

export const PolicyGrid = () => (
  <Section id="limits" className="border-t-1 border-border py-14 md:py-20 lg:py-24">
    <Container>
      <Reveal>
        <SectionIntro title="Four things the policy stops">
          Every request is checked against its key, before anything is signed.
        </SectionIntro>
      </Reveal>

      <Reveal delay={0.06} className="mt-8 md:mt-10">
        <div className="mx-auto max-w-[60rem] overflow-hidden rounded-xl border-1 border-border bg-surface/20">
          <div className="grid md:grid-cols-2">
            {QUADRANTS.map((quadrant, index) => (
              <div
                key={quadrant.title}
                className={cn(
                  "relative flex min-w-0 flex-col gap-5 p-6 sm:p-7",
                  index % 2 === 0 && "md:border-r-1 md:border-border",
                  index < 2 && "border-b-1 border-border",
                )}
              >
                <div>
                  <span className="type-mono text-[0.8125rem] font-medium text-ink-subtle">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-[0.9375rem] font-medium text-foreground">
                    {quadrant.title}
                  </h3>
                  <p className="mt-1.5 text-[0.875rem] leading-[1.6] text-muted">{quadrant.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </Container>
  </Section>
);
