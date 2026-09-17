import { ChainIcon, CheckmarkCircle02Icon, Icon, TokenIcon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { Container, Reveal, Section, SectionIntro } from "#/components/marketing/primitives";

/* -------------------------------------------------------------------------
 * Anatomy of a session key.
 *
 * The spec sheet this replaced said the same thing three times: the field, the
 * value, and a sentence explaining the value. Here the key states its own
 * values and the margins name the guarantee — four labels, eight words each,
 * set in mono the way a drawing is annotated rather than a paragraph written.
 * ---------------------------------------------------------------------- */

const Note = ({
  label,
  children,
  align,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly align: "left" | "right";
}) => (
  <div className={cn("flex flex-col gap-2", align === "right" ? "lg:items-end" : "lg:items-start")}>
    <p
      className={cn(
        "type-mono text-[0.625rem] tracking-[0.14em] uppercase text-muted",
        align === "right" && "lg:text-right",
      )}
    >
      {label}
    </p>
    <p
      className={cn(
        "type-mono max-w-[24ch] text-[0.6875rem] leading-[1.75] text-ink-subtle",
        align === "right" && "lg:text-right",
      )}
    >
      {children}
    </p>
  </div>
);

const Field = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 border-t-1 border-border px-4 py-2.5">
    <span className="text-[0.75rem] text-ink-subtle">{label}</span>
    <span className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-foreground">
      {children}
    </span>
  </div>
);

/** The key itself, drawn as the product draws it. */
const KeyCard = () => (
  <div
    className={cn(
      "edge-top relative w-[24rem] shrink-0 overflow-hidden rounded-lg border-1 border-hairline-strong",
      "bg-[linear-gradient(168deg,#17181c_0%,#121316_52%,#0d0e11_100%)]",
      "shadow-[0_18px_40px_-24px_rgb(0_0_0/0.9)]",
    )}
  >
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md bg-[#3a2a52] text-[0.875rem]"
      >
        🦄
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-medium text-foreground">Uniswap Agent</p>
        <p className="mt-0.5 text-[0.6875rem] text-ink-subtle">Issued 10 Sept 2026</p>
      </div>
      <Icon
        icon={CheckmarkCircle02Icon}
        aria-hidden
        strokeWidth={1.9}
        className="size-3.5 shrink-0 text-success"
      />
    </div>

    <Field label="Account">
      <span
        aria-hidden
        className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-default/70 text-[0.5625rem]"
      >
        😀
      </span>
      Trading Account
    </Field>

    <Field label="Networks">
      <ChainIcon
        namespace="eip155"
        chain="ethereum"
        aria-hidden
        className="size-3.5 rounded-[3px]"
      />
      <ChainIcon namespace="eip155" chain="base" aria-hidden className="size-3.5 rounded-[3px]" />
    </Field>

    <Field label="Expires">27 Sept 2026</Field>

    <Field label="Signatures">
      <span className="text-ink-subtle">Off</span>
    </Field>

    <div className="border-t-1 border-border px-4 py-3">
      <p className="flex items-center gap-2 text-[0.75rem] text-foreground">
        <TokenIcon symbol="USDC" className="size-3.5" />
        100 USDC per network
      </p>
      <p className="type-mono mt-1 truncate text-[0.625rem] text-ink-subtle">
        0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
      </p>
    </div>
  </div>
);

export const KeyAnatomy = () => (
  <Section id="policy" className="border-t-1 border-border">
    <Container>
      <Reveal>
        <SectionIntro title="Every agent operates within limits">
          You set the account, chains, expiry and cap when you create it. The agent gets the key,
          never the policy.
        </SectionIntro>
      </Reveal>

      <Reveal delay={0.06} className="mt-16 md:mt-28">
        <div className="grid items-center justify-items-center gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-16">
          <div className="flex w-full flex-col gap-12 lg:gap-28">
            <Note label="Scope" align="right">
              One account. Nothing else in the workspace is reachable.
            </Note>
            <Note label="Expiry" align="right">
              Set an expiration date. Access automatically ends when time runs out.
            </Note>
          </div>

          <div className="order-first sm:order-none sm:col-span-2 lg:col-span-1">
            <KeyCard />
          </div>

          <div className="flex w-full flex-col gap-12 lg:gap-28">
            <Note label="Networks" align="left">
              Choose which networks the agent can use. Everything else is blocked.
            </Note>
            <Note label="Spending" align="left">
              Set spending limits for each token, contract, or network.
            </Note>
          </div>
        </div>
      </Reveal>
    </Container>
  </Section>
);
