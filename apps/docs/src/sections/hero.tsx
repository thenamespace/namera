import { useEffect, useState } from "react";

import { Link } from "@tanstack/react-router";

import { Button } from "@namera-ai/ui/components/ui/button";
import { ButtonGroup } from "@namera-ai/ui/components/ui/button-group";
import { ArrowRight, CheckIcon, CopyIcon } from "lucide-react";
import { useCopyToClipboard } from "usehooks-ts";

export const Hero = () => {
  const [_, copy] = useCopyToClipboard();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copy("npm i -g @namera-ai/cli").catch(console.error);
    setCopied(true);
  };

  useEffect(() => {
    if (!copied) return;

    const timeout = window.setTimeout(() => {
      setCopied(false);
    }, 1600);

    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <section className="relative pt-[18dvh] pb-[8dvh] overflow-hidden">
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 50% at 50% 40%, #000 30%, transparent 80%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto flex flex-col gap-6 px-4 ">
        <div className="flex flex-col gap-7 text-center sm:text-left">
          <h1 className="pb-2 text-4xl leading-[0.96] sm:text-5xl md:text-6xl lg:text-7xl md:leading-[0.92] text-balance tracking-tight font-medium heading-gradient">
            Programmable wallets
            <br />
            for autonomous agents
          </h1>
          <p className="text-muted-foreground text-sm font-normal md:text-base max-w-4xl mx-auto sm:mx-0">
            Define fine-grained permissions with session keys and let agents
            execute transactions on your behalf.
          </p>
          <ButtonGroup>
            <Button
              className="rounded-xl"
              onClick={handleCopy}
              size="xl"
              variant="outline"
            >
              <span className="font-geist-mono px-2">
                npm i -g @namera-ai/cli
              </span>
              {copied ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </Button>
            <Button
              className="rounded-xl group pr-4"
              render={<Link to="/docs/$" />}
              size="xl"
              variant="outline"
            >
              Docs
              <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-all" />
            </Button>
          </ButtonGroup>
        </div>
        {/* Video container with glowing border + fade mask */}
        <div className="relative mt-6">
          {/* Outer glow */}
          <div
            aria-hidden={true}
            className="pointer-events-none absolute -inset-px rounded-[18px] opacity-70"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 30%, transparent 60%)",
            }}
          />
          {/* Ambient colored glow behind video */}
          <div
            aria-hidden={true}
            className="pointer-events-none absolute -inset-8 -z-10 blur-3xl opacity-40"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 30% 0%, rgba(182,214,255,0.25), transparent 70%), radial-gradient(ellipse 60% 60% at 70% 0%, rgba(214,254,81,0.15), transparent 70%)",
            }}
          />
          <div className="relative rounded-[18px] border border-white/10 bg-white/2 p-1.5 backdrop-blur-sm">
            <div className="relative overflow-hidden rounded-xl">
              <video
                autoPlay={true}
                className="w-full block"
                controls={false}
                disablePictureInPicture={true}
                loop={true}
                muted={true}
                poster="https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcK8urJOvLOaQlLduTRAgwbGEzMkpcHBZnDfY9P"
                src="https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKlPJKvydv8A6jcXM3ehpNnSUiG7f0Vs2glHFW"
              />
              <div
                aria-hidden={true}
                className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent, #08090a 95%)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
