import { CheckIcon, XIcon } from "@phosphor-icons/react";

const withoutNamera = [
  "Managing private keys and access manually",
  "Building custom permission systems from scratch",
  "Handling wallet security and edge cases yourself",
  "Writing complex logic for every transaction flow",
  "No safe way to delegate access to agents",
];

const withNamera = [
  "Smart wallets with programmable control",
  "Scoped access for agents without exposing keys",
  "Define permissions once and reuse across workflows",
  "Agents execute transactions safely and automatically",
  "No need to manage wallet infrastructure or security",
  "Integrates easily with apps, agents, and systems",
];

export const WhyNamera = () => {
  return (
    <section
      className="px-4 max-w-7xl mx-auto py-[5dvh] min-h-dvh flex items-center justify-evenly flex-col"
      id="why-namera"
    >
      <h2 className="text-3xl max-w-3xl mx-auto text-center heading-gradient pb-2 sm:text-4xl md:text-5xl">
        Building agent wallets is complex.
        <br />
        Without Namera, it's harder.
      </h2>
      <div className="flex-col items-start flex lg:flex-row max-w-4xl mx-auto w-full justify-between py-24 gap-8 lg:gap-0">
        <div className="flex flex-col gap-4 pt-12">
          <div className="bg-popover rounded-xl h-28 lg:w-[16rem] w-full" />
          <div className="flex flex-col gap-2 w-full">
            <div className="text-lg text-foreground/70 font-medium py-4 w-full">
              Without Namera...
            </div>
            <div className="flex flex-col text-sm gap-2 text-foreground/70">
              {withoutNamera.map((text, i) => (
                <div
                  className="flex flex-row gap-2 items-center"
                  key={`without-namera-${i.toString()}`}
                >
                  <XIcon />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 ">
          <div className="max-w-[24rem] bg-popover rounded-xl h-40 w-full" />
          <div className="flex flex-col gap-2 w-full">
            <div className="text-2xl text-foreground font-semibold py-4">
              With Namera...
            </div>
            <div className="flex flex-col text-base gap-2 text-foreground">
              {withNamera.map((text, i) => (
                <div
                  className="flex flex-row gap-2 items-center"
                  key={`with-namera-${i.toString()}`}
                >
                  <CheckIcon />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
