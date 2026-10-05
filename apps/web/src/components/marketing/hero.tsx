import { HeroCta } from "#/components/marketing/hero-cta";
import { HeroObject } from "#/components/marketing/hero-object";
import { Container } from "#/components/marketing/primitives";

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

export const Hero = () => (
  <section className="relative isolate overflow-hidden pt-28 pb-24 md:pt-36 md:pb-32">
    <Container className="max-w-[1280px] md:w-[92%]">
      <div className="reveal-init flex flex-col gap-7">
        <h1 className="type-display-xl max-w-[24ch] text-[clamp(2rem,1.25rem+3.2vw,3.75rem)] text-balance text-foreground">
          Give your agents a wallet
          <br />
          with limits built in.
        </h1>
        <p className="type-lead max-w-[64ch] text-base text-pretty text-muted md:text-[1.0625rem]">
          Set what your agent can spend, which contracts it can use, and when its access expires.
          Every action is enforced against those permissions.
        </p>
        <div className="mt-3">
          <HeroCta />
        </div>
      </div>
    </Container>

    <Container className="reveal-init mt-16 max-w-[1280px] md:mt-20 md:w-[92%]">
      <div className="relative pb-[var(--floor)] [--floor:3.75rem] sm:[--floor:5.5rem] lg:[--floor:6.25rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[-5%] inset-y-0 -z-10 overflow-hidden rounded-lg"
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
