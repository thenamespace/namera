import { useEffect, useRef, useState } from "react";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (
        entry?.isIntersecting &&
        !reducedMotion &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        !paused
      ) {
        // Autoplay can be denied by browser policy; the poster remains visible.
        void video.play().catch(() => setPaused(true));
      } else {
        video.pause();
      }
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, [paused, reducedMotion]);

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
        <div data-hero-preview className="relative origin-bottom pb-28 sm:pb-36 lg:pb-44">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[-6%] inset-y-0 -z-10 overflow-hidden"
          >
            <video
              ref={videoRef}
              loop
              muted
              playsInline
              preload="none"
              poster="/hero-bg-poster.jpg"
              src={reducedMotion ? undefined : "https://cdn.namera.ai/web/videos/hero-bg.mp4"}
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
          {!reducedMotion ? (
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              className="absolute right-0 bottom-4 min-h-11 rounded-md bg-background/90 px-3 text-xs text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {paused ? "Play background" : "Pause background"}
            </button>
          ) : null}
        </div>
      </Container>
    </section>
  );
};
