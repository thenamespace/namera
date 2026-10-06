import { useEffect } from "react";

import { stagger, useAnimate, useReducedMotion } from "motion/react";

import { HeroCta } from "#/components/marketing/hero-cta";
import { HeroObject } from "#/components/marketing/hero-object";
import { Container } from "#/components/marketing/primitives";
import { SITE } from "#/lib/seo";

const STAGE_MASK =
  "linear-gradient(to bottom, transparent 0%, #000 8%, #000 74%, transparent 99%), " +
  "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)";

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
            className="type-display-xl max-w-[24ch] text-[clamp(2.125rem,1rem+4vw,4rem)] font-medium text-balance text-foreground"
          >
            Wallets for AI agents
            <br />
            with permissions built in
          </h1>
          <p
            data-hero-copy
            className="type-lead max-w-[76ch] text-[0.9375rem] font-[350] text-pretty text-muted md:text-base"
          >
            {SITE.heroDescription}
          </p>
          <div data-hero-copy>
            <HeroCta />
          </div>
        </div>
      </Container>

      <Container className="mt-16 md:mt-20">
        <div data-hero-preview className="relative origin-bottom pb-28 sm:pb-36 lg:pb-44">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[-6%] inset-y-0 -z-10 overflow-hidden"
          >
            <img
              src="/hero-bg-poster.jpg"
              alt=""
              width={1200}
              height={1500}
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
};
