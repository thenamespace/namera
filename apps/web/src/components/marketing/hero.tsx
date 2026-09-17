import { HeroCta } from "#/components/marketing/hero-cta";
import { HeroObject } from "#/components/marketing/hero-object";
import { Container } from "#/components/marketing/primitives";

/* -------------------------------------------------------------------------
 * The hero: a sentence, and the product.
 *
 * Left-aligned, with no controls in it. The header already carries Sign in
 * and Docs, and the page ends on a call to action; a hero that asks for a
 * decision before it has shown anything is asking too early.
 * ---------------------------------------------------------------------- */

/*
 * The stage.
 *
 * A single light source low and behind the window: a looping grayscale smoke
 * clip (the same one from the live site), not a static gradient. It fills a
 * frame 5% wider than the window and running its full height plus the floor
 * below. Rather than clip to a hard rectangle — which left a sharp white-to-black
 * seam on every side — the clip is masked on all four edges by intersecting two
 * linear masks (one vertical, one horizontal). It stays solid only through the
 * middle, where the window covers it, and ramps to transparent toward each edge,
 * so the smoke reads as an ambient glow that fades to black with no visible edge.
 */
const STAGE_MASK_V =
  "linear-gradient(to bottom, transparent 0%, #000 8%, #000 74%, transparent 99%)";
const STAGE_MASK_H =
  "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)";
const STAGE_MASK = `${STAGE_MASK_V}, ${STAGE_MASK_H}`;

export const Hero = () => (
  <section className="relative isolate overflow-hidden pt-28 pb-24 md:pt-36 md:pb-32">
    <Container>
      <div className="reveal-init flex flex-col gap-7">
        <h1 className="type-display-xl max-w-[20ch] text-balance text-foreground">
          Give your agents a wallet
          <br />
          with limits built in.
        </h1>
        <p className="type-lead max-w-[64ch] text-pretty text-muted">
          Set what your agent can spend, which contracts it can use, and when its access expires.
          Every action is enforced against those permissions.
        </p>
        <div className="mt-3">
          <HeroCta />
        </div>
      </div>
    </Container>

    {/*
      The stage sits behind the window rather than around it, so the window is
      exactly as wide as every other section's content and the light still spills
      5% past it on each side. The floor is 15.6% of the window's height.
    */}
    <Container className="reveal-init mt-16 md:mt-20">
      <div className="relative pb-[var(--floor)] [--floor:7rem] sm:[--floor:9rem] lg:[--floor:11rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[-6%] inset-y-0 -z-10 overflow-hidden"
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/hero-bg-poster.jpg"
            src="/hero-bg.mp4"
            className="size-full object-cover"
            style={{
              maskImage: STAGE_MASK,
              maskComposite: "intersect",
              WebkitMaskImage: STAGE_MASK,
              WebkitMaskComposite: "source-in",
            }}
          />
        </div>

        <HeroObject />
      </div>
    </Container>
  </section>
);
