import { Button } from "@namera-ai/ui/components/ui/button";
import { Input } from "@namera-ai/ui/components/ui/input";

export const Hero = () => {
  return (
    <section className="relative mx-auto pb-48">
      <div
        className="w-full mx-auto text-center container px-2"
        style={{
          backgroundImage: "url(/assets/spotlight.jpg)",
          backgroundPosition: "center top -50px",
          backgroundRepeat: "no-repeat",
          backgroundSize: "auto 120%",
        }}
      >
        <div className="flex flex-col gap-4">
          <h1 className="pt-32 font-helveticaDisplay heading-gradient pb-2 text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
            Programmable wallets
            <br /> for autonomous agents
          </h1>
          <div className="max-w-lg mx-auto text-center flex flex-col gap-8">
            <p className="text-sm text-muted-foreground font-normal sm:text-base md:text-lg">
              Define fine-grained permissions with session keys and let agents
              execute transactions on your behalf.
            </p>
            <div className="flex flex-col gap-2 mx-auto sm:flex-row">
              <Input
                className="h-10 w-[20rem] px-3"
                placeholder="Your email address"
                type="email"
              />
              <Button className="cta-button" size="xl">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-center relative my-16">
        <img
          alt="Hero"
          className="absolute hidden md:block max-w-none"
          height={500}
          src="/assets/hero-md.jpg"
          width={1750}
        />
        <img
          alt="Hero"
          className="absolute block md:hidden max-w-none"
          height={400}
          src="/assets/hero-sm.jpg"
          width={800}
        />
        <div className="z-10 aspect-video max-w-216 w-full relative mx-4">
          <img
            alt="Namera Agent executing transactions"
            src="/assets/hero.png"
          />
        </div>
      </div>
    </section>
  );
};
