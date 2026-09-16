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
 * Measured off Linear's hero pixel by pixel. One light source, low and behind
 * the window, doing two things at once:
 *
 *   Around the window — nothing for the first eighth, then a smooth ramp down
 *   the sides: 0.012 alpha a sixth of the way down, 0.045 at a third, 0.11 at
 *   the halfway mark, 0.16 at three quarters, 0.19 at the bottom corner.
 *
 *   Below it — a floor. Hard top edge at the window's base, constant
 *   brightness for its whole height, falloff only horizontally in a wide
 *   symmetric bell: 0.20 at the sides, 0.47 under the middle.
 *
 * The part that took three tries to get right is the bottom. Linear's light
 * does not fade out; it stops dead, because the whole thing lives inside a
 * clipped frame. So this is a frame too — the window sits in a rounded box
 * that extends 7% of the window's width past each side and 15.6% of its height
 * below, and the light is clipped by it. Above the window there is no light,
 * so the top of the box is invisible and only the lit bottom corners read.
 */
const BACKGLOW =
  "linear-gradient(to bottom," +
  "rgb(236 243 255/0) 12%," +
  "rgb(236 243 255/0.012) 16%," +
  "rgb(236 243 255/0.045) 30%," +
  "rgb(236 243 255/0.077) 44%," +
  "rgb(236 243 255/0.109) 58%," +
  "rgb(236 243 255/0.158) 72%," +
  "rgb(236 243 255/0.174) 85%," +
  "rgb(236 243 255/0.194) 100%)";

const FLOOR =
  "linear-gradient(to right," +
  "rgb(236 243 255/0.20) 0%," +
  "rgb(236 243 255/0.27) 10%," +
  "rgb(236 243 255/0.32) 20%," +
  "rgb(236 243 255/0.38) 30%," +
  "rgb(236 243 255/0.44) 40%," +
  "rgb(236 243 255/0.47) 50%," +
  "rgb(236 243 255/0.43) 60%," +
  "rgb(236 243 255/0.37) 70%," +
  "rgb(236 243 255/0.31) 80%," +
  "rgb(236 243 255/0.26) 90%," +
  "rgb(236 243 255/0.21) 100%)";

export const Hero = () => (
  <section className="relative isolate overflow-hidden pt-28 pb-24 md:pt-36 md:pb-32">
    <Container>
      <div className="reveal-init flex flex-col gap-7">
        <h1 className="type-display-xl max-w-[20ch] text-balance text-foreground">
          Give your agents a wallet they can&rsquo;t misuse
        </h1>
        <p className="type-lead max-w-[50ch] text-pretty text-muted">
          Set the limits once. Every transaction is checked against them before anything is signed.
        </p>
      </div>
    </Container>

    {/*
      The stage sits behind the window rather than around it, so the window is
      exactly as wide as every other section's content and the light still spills
      5% past it on each side. The floor is 15.6% of the window's height.
    */}
    <Container className="reveal-init mt-16 md:mt-20">
      <div className="relative pb-[var(--floor)] [--floor:3.75rem] sm:[--floor:5.5rem] lg:[--floor:6.25rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[-5%] inset-y-0 -z-10 overflow-hidden rounded-xl sm:rounded-[1.25rem]"
        >
          <div
            className="absolute inset-x-0 top-0 bottom-[var(--floor)]"
            style={{ background: BACKGLOW }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[var(--floor)]"
            style={{ background: FLOOR }}
          />
        </div>

        <HeroObject />
      </div>
    </Container>
  </section>
);
