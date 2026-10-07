import { cn } from "@namera-ai/ui/utils";

import { Container, Reveal, Section } from "#/components/marketing/primitives";
import { ShaderField } from "#/components/marketing/shader-field";

import { HeroCta } from "./hero-cta";

export const ClosingCta = () => (
  <Section id="waitlist" className="relative isolate overflow-hidden border-t-1 border-border">
    {/* masked, so the field dies out before it reaches the section's hairlines */}
    <ShaderField
      className={
        cn(
          "pointer-events-none absolute inset-0 -z-20 size-full",
          "[mask-image:radial-gradient(78%_72%_at_50%_48%,black_0%,black_38%,transparent_88%)]",
        ) ?? ""
      }
    />
    {/*
        The field runs bright in places, and body copy over a bright patch is a
        contrast failure. This holds the middle of the section near the page's
        own background so the type keeps its ratio, and lets the filaments carry
        the edges.
      */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(60% 52% at 50% 50%, var(--background) 0%, color-mix(in srgb, var(--background) 82%, transparent) 42%, transparent 78%)",
      }}
    />

    <Container>
      <Reveal>
        <div className="flex flex-col items-center py-12 text-center md:py-24">
          <h2 className="type-display-xl max-w-[15ch] text-balance text-foreground">
            Launching soon!
          </h2>
          <p className="type-lead mt-6 max-w-[46ch] text-pretty text-muted">
            Smart accounts, session keys, and onchain policies - all in one place, ready for agents.
          </p>

          <div className="mt-10 w-full max-w-[30rem]">
            <HeroCta idPrefix="waitlist" />
          </div>
        </div>
      </Reveal>
    </Container>
  </Section>
);
