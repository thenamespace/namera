import {
  CheckIcon,
  QuestionMarkIcon,
  TriangleIcon,
  XIcon,
} from "@phosphor-icons/react";

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

const lines = Array.from({ length: 50 });

const MovingRails = () => {
  return (
    <>
      <div className="absolute inset-0">
        <div className="flex w-max animate-[scroll_20s_linear_infinite] gap-10">
          {[...lines, ...lines].map((_, i) => (
            <div
              className="rounded-full border-neutral-700 h-px border opacity-80"
              key={`slow-${i.toString()}`}
              style={{
                marginTop: `${Math.random() * 160}px`,
                width: `${20 + Math.random() * 40}px`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-0">
        <div className="flex w-max animate-[scroll_8s_linear_infinite] gap-10">
          {[...lines, ...lines].map((_, i) => (
            <div
              className="rounded-full border-neutral-700 border h-px"
              key={`fast-${i.toString()}`}
              style={{
                marginTop: `${Math.random() * 160}px`,
                width: `${20 + Math.random() * 60}px`,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
};

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
      <div className="flex-col items-center lg:items-start flex lg:flex-row max-w-4xl mx-auto w-full justify-between py-24 gap-8 lg:gap-0">
        <div className="flex flex-col gap-4 pt-12">
          <div className="bg-muted rounded-xl h-28 lg:w-[16rem] w-full relative overflow-hidden">
            <MovingRails />
            <div className="absolute top-1/2 right-1/2 size-6 bg-white rounded-full flex items-center justify-center animate-path confused translate-x-1/2">
              <QuestionMarkIcon className="text-border" strokeWidth={2} />
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <div className="text-lg text-muted-foreground font-medium py-4 w-full">
              Without Namera...
            </div>
            <div className="flex flex-col text-sm gap-2 text-muted-foreground">
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
          <div className="max-w-[24rem] bg-muted rounded-xl h-40 w-full overflow-hidden relative">
            <MovingRails />
            <div className="rotate-90 absolute top-1/2 right-1/2">
              <TriangleIcon
                className="animate-triangle-path size-8 fill-white"
                weight="fill"
              />
            </div>
          </div>
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
