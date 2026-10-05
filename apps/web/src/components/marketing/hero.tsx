import { useEffect } from "react";

import { stagger, useAnimate, useReducedMotion } from "motion/react";

import { HeroCta } from "#/components/marketing/hero-cta";
import { HeroObject } from "#/components/marketing/hero-object";
import { Container } from "#/components/marketing/primitives";
import { SITE } from "#/lib/seo";

// Static side light and a clipped floor restore the original dashboard stage.
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

export const Hero = () => {
  const [scope, animate] = useAnimate();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Animate after hydration so server-rendered content never depends on JS to be visible.
    const reveal = animate([
      [
        "[data-hero-copy]",
        {
          opacity: [0, 1],
          filter: ["blur(6px)", "blur(0px)"],
          transform: ["translateY(14px)", "translateY(0px)"],
        },
        { duration: 0.7, delay: stagger(0.08), ease: [0.22, 1, 0.36, 1] },
      ],
      [
        "[data-hero-preview]",
        {
          opacity: [0, 1],
          filter: ["blur(4px)", "blur(0px)"],
          transform: ["translateY(24px) scale(0.985)", "translateY(0px) scale(1)"],
        },
        { at: 0.16, duration: 0.9, ease: [0.22, 1, 0.36, 1] },
      ],
    ]);

    return () => reveal.cancel();
  }, [animate, reducedMotion]);

  return (
    <section
      ref={scope}
      className="relative isolate overflow-hidden pt-40 pb-24 md:pt-56 md:pb-32 lg:pt-64"
    >
      <Container>
        <div className="flex flex-col gap-7">
          <h1
            data-hero-copy
            className="type-display-xl max-w-[24ch] text-[clamp(1.875rem,1.125rem+2.8vw,3.25rem)] text-balance text-foreground"
          >
            Wallets for AI agents
            <br />
            with permissions built in
          </h1>
          <p
            data-hero-copy
            className="type-lead max-w-[76ch] text-[0.9375rem] text-pretty text-muted md:text-base"
          >
            {SITE.heroDescription}
          </p>
          <div data-hero-copy>
            <HeroCta />
          </div>
        </div>
      </Container>

      <Container className="mt-16 md:mt-20">
        <div
          data-hero-preview
          className="relative origin-bottom pb-[var(--floor)] [--floor:3.75rem] sm:[--floor:5.5rem] lg:[--floor:6.25rem]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-lg"
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
};
