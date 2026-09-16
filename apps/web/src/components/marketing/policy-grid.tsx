import { CancelCircleIcon, ComputerTerminal01Icon, Icon, Key01Icon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { Container, Reveal, Section, SectionIntro } from "#/components/marketing/primitives";

/* -------------------------------------------------------------------------
 * Four things the policy stops.
 *
 * One bordered box, quartered — not four cards, and not four open hairlines
 * against the page. Inside each quarter an artifact is lit from behind, sits
 * on a shadow, and fades out as it leaves the frame, so it reads as a moment
 * caught in the product rather than a screenshot laid on a slide.
 *
 * The copy is deliberately two short lines. The picture is doing the work.
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
      "edge-top relative rounded-lg border-1 border-hairline-strong",
      "bg-[linear-gradient(168deg,#17181c_0%,#121316_52%,#0d0e11_100%)]",
      "shadow-[0_18px_40px_-24px_rgb(0_0_0/0.9)]",
      className,
    )}
  >
    {children}
  </div>
);

/* -------------------------------- artifacts ------------------------------- */

const QUEUE = [
  { what: "Transfer 5 USDC", sub: "Payouts Agent", state: "ok" },
  { what: "Approve USDC spend", sub: "Uniswap Agent", state: "ok" },
  { what: "Swap 120 USDC for ETH", sub: "over the 100 USDC cap", state: "blocked" },
  { what: "Swap 40 USDC for ETH", sub: "Uniswap Agent", state: "ok" },
  { what: "Gas top-up", sub: "Uniswap Agent", state: "ok" },
] as const;

/** 0.1 — a queue of requests, with the one that does not pass lit in red. */
const RefusalArtifact = () => (
  <div className="relative w-[38rem]">
    <div
      className="relative flex flex-col gap-1.5"
      style={{
        maskImage: "linear-gradient(to bottom,transparent,#000 22%,#000 72%,transparent)",
      }}
    >
      {QUEUE.map((row, index) => {
        const blocked = row.state === "blocked";
        return (
          <Card
            key={row.what}
            className={cn(
              "flex items-center gap-3 px-3.5 py-2.5",
              blocked ? "border-danger/30 bg-danger/6" : "opacity-70",
              index === 0 && "opacity-35",
              index === QUEUE.length - 1 && "opacity-35",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                blocked ? "bg-danger" : "bg-success/80",
              )}
            />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-[0.8125rem]",
                  blocked ? "text-foreground" : "text-muted",
                )}
              >
                {row.what}
              </span>
              <span
                className={cn(
                  "block truncate text-[0.6875rem]",
                  blocked ? "text-danger/90" : "text-ink-subtle",
                )}
              >
                {row.sub}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 text-[0.6875rem]",
                blocked ? "text-danger" : "text-ink-subtle",
              )}
            >
              {blocked ? "Refused" : "Signed"}
            </span>
          </Card>
        );
      })}
    </div>
  </div>
);

/** 0.2 — the approval, floating over the terminal that asked for it. */
const DeviceArtifact = () => (
  <div className="relative w-[37rem]">
    {/* the request, behind */}
    <Card className="absolute top-0 left-14 w-[27rem] px-4 py-3 opacity-40">
      <p className="type-mono text-[0.6875rem] text-ink-subtle">
        $ namera login
        <br />
        waiting for approval…
      </p>
    </Card>

    {/* the approval, in front */}
    <Card className="relative top-16 w-[29rem] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-md bg-default/70 text-muted"
        >
          <Icon icon={ComputerTerminal01Icon} strokeWidth={1.7} className="size-3.5" />
        </span>
        <p className="text-[0.8125rem] font-medium text-foreground">
          Namera CLI is requesting access
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t-1 border-border px-4 py-2.5">
        <span className="text-[0.6875rem] text-ink-subtle">Verification code</span>
        <span className="type-mono text-[0.75rem] tracking-[0.08em] text-foreground">
          R77H-3L96
        </span>
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
  </div>
);

/** 0.3 — one key running down, with the ones behind it fading out. */
const ExpiryArtifact = () => (
  <div className="relative w-[35rem]">
    <Card className="absolute top-0 left-20 w-[26rem] px-4 py-3 opacity-25">
      <p className="text-[0.8125rem] text-muted">Research Agent</p>
    </Card>
    <Card className="absolute top-7 left-10 w-[27rem] px-4 py-3 opacity-45">
      <p className="text-[0.8125rem] text-muted">Payouts Agent</p>
    </Card>

    <Card className="relative top-16 w-[28rem] overflow-hidden">
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
        <span className="shrink-0 text-[0.75rem] text-muted tabular-nums">12d</span>
      </div>
      <div className="h-1 bg-default">
        <div className="h-full w-[58%] bg-accent" />
      </div>
    </Card>
  </div>
);

const KEYS = [
  { name: "Uniswap Agent", account: "Trading Account", revoked: false },
  { name: "Payouts Agent", account: "Treasury", revoked: true },
  { name: "Research Agent", account: "Trading Account", revoked: false },
] as const;

/** 0.4 — one key cut, the others carrying on. */
const RevokeArtifact = () => (
  <div className="relative w-[36rem]">
    <div className="relative flex flex-col gap-2">
      {KEYS.map((key) => (
        <Card
          key={key.name}
          className={cn("flex items-center gap-3 px-4 py-3", key.revoked && "border-danger/25")}
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
                key.revoked
                  ? "text-ink-subtle line-through decoration-danger/50"
                  : "text-foreground",
              )}
            >
              {key.name}
            </span>
            <span className="block truncate text-[0.6875rem] text-ink-subtle">{key.account}</span>
          </span>
          <span
            className={cn(
              "shrink-0 text-[0.6875rem]",
              key.revoked ? "text-danger" : "text-success",
            )}
          >
            {key.revoked ? "Revoked" : "Active"}
          </span>
        </Card>
      ))}
    </div>
  </div>
);

/* ---------------------------------- grid ---------------------------------- */

const QUADRANTS = [
  {
    artifact: RefusalArtifact,
    title: "An agent spends past its cap",
    body: "The transaction is refused before it is signed. Nothing reaches the network and no gas is spent.",
  },
  {
    artifact: DeviceArtifact,
    title: "A new device asks for access",
    body: "Nothing runs until you approve the device, against a code shown in both places.",
  },
  {
    artifact: ExpiryArtifact,
    title: "A key reaches its expiry",
    body: "The key stops signing on its end date. Renew it, or let it lapse and the agent simply stops.",
  },
  {
    artifact: RevokeArtifact,
    title: "You revoke a single agent",
    body: "Revoke one key and the rest keep running, including the work already in flight.",
  },
] as const;

export const PolicyGrid = () => (
  <Section id="limits" className="border-t-1 border-border">
    <Container>
      <Reveal>
        <SectionIntro title="Four things the policy stops">
          Every request is checked against the key it came from, before anything is signed.
        </SectionIntro>
      </Reveal>

      <Reveal delay={0.06} className="mt-16 md:mt-28">
        <div className="overflow-hidden rounded-xl border-1 border-border bg-surface/20">
          <div className="grid md:grid-cols-2">
            {QUADRANTS.map((quadrant, index) => (
              <div
                key={quadrant.title}
                className={cn(
                  // `min-w-0`: a grid item defaults to min-width:auto, so a wide
                  // artifact would widen the track instead of being clipped.
                  "relative flex min-w-0 flex-col",
                  index % 2 === 0 && "md:border-r-1 md:border-border",
                  index < 2 && "border-b-1 border-border",
                )}
              >
                <div className="relative h-[19rem] overflow-hidden sm:h-[29rem]">
                  <div className="absolute top-12 left-6 sm:top-16 sm:left-12">
                    <quadrant.artifact />
                  </div>
                </div>

                <div className="px-6 pt-2 pb-12 sm:px-12 sm:pb-16">
                  <h3 className="text-[0.9375rem] font-medium text-foreground">{quadrant.title}</h3>
                  <p className="mt-2 max-w-[34ch] text-[0.9375rem] leading-[1.6] text-muted">
                    {quadrant.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </Container>
  </Section>
);
