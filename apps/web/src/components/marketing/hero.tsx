import { HeroCta } from "#/components/marketing/hero-cta";
import { finishHeroEntrance } from "#/components/marketing/hero-entrance";
import { HeroObject } from "#/components/marketing/hero-object";
import { Container } from "#/components/marketing/primitives";
import { SITE } from "#/lib/seo";

const STAGE_MASK =
  "linear-gradient(to bottom, transparent 0%, #000 8%, #000 74%, transparent 99%), " +
  "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)";

export const Hero = () => {
  return (
    <section className="landing-hero relative isolate overflow-hidden pt-40 pb-24 md:pt-56 md:pb-32 lg:pt-64">
      <Container>
        <div className="flex flex-col gap-7">
          <h1 className="type-display-xl max-w-[24ch] text-[clamp(2.125rem,1rem+4vw,4rem)] font-medium text-balance text-foreground">
            <span data-hero-title-line className="inline-block">
              Wallets for AI agents
            </span>
            <br />
            <span data-hero-title-line className="inline-block">
              with permissions built in
            </span>
          </h1>
          <p
            data-hero-copy
            className="type-lead max-w-[76ch] text-[0.9375rem] font-[350] text-pretty text-muted md:text-base"
          >
            {SITE.heroDescription}
          </p>
          <div data-hero-cta onFocusCapture={(event) => finishHeroEntrance(event.currentTarget)}>
            <HeroCta />
          </div>
        </div>
      </Container>

      <Container className="mt-16 md:mt-20">
        <div
          data-hero-preview
          onFocusCapture={(event) => finishHeroEntrance(event.currentTarget)}
          className="relative origin-bottom pb-28 sm:pb-36 lg:pb-44"
        >
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
