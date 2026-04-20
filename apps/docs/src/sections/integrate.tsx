import { useEffect } from "react";

import { Avatar, AvatarGroup } from "@namera-ai/ui/components/ui/avatar";
import { buttonVariants } from "@namera-ai/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@namera-ai/ui/components/ui/tooltip";
import { NameraIcon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/lib/utils";
import {
  NetworkArbitrumOne,
  NetworkArc,
  NetworkAvalanche,
  NetworkBase,
  NetworkEthereum,
  NetworkMonad,
  NetworkOptimism,
  NetworkPolygon,
  NetworkScroll,
  NetworkTempo,
  NetworkUnichain,
  NetworkZora,
} from "@web3icons/react";
import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";

import { GridOverlay } from "@/components/misc";

const supportedChains = [
  {
    icon: NetworkEthereum,
    title: "Ethereum",
  },
  {
    icon: NetworkBase,
    title: "Base",
  },
  {
    icon: NetworkPolygon,
    title: "Polygon",
  },
  {
    icon: NetworkArbitrumOne,
    title: "Arbitrum",
  },
  {
    icon: NetworkScroll,
    title: "Scroll",
  },
  {
    icon: NetworkOptimism,
    title: "Optimism",
  },
  {
    icon: NetworkTempo,
    title: "Tempo",
  },
  {
    icon: NetworkAvalanche,
    title: "Avalanche",
  },
  {
    icon: NetworkUnichain,
    title: "Unichain",
  },
  {
    icon: NetworkMonad,
    title: "Monad",
  },
  {
    icon: NetworkZora,
    title: "Zora",
  },
  {
    icon: NetworkArc,
    title: "Arc",
  },
];

const leftIcons = [
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKS9KAizQyghR3cbAUdQupkPIZBfGXY9CHMFt4",
    title: "USDC",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcK3je8iYsgdt63Nik9WJIYpTSPrqZ450EzjOwy",
    title: "Base",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKFhrtDaKVboBCWguHlNkJpxPhrQR4i3qvXm1n",
    title: "OpenAI",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKgj88qIb6hiE1LZ0JUPqItTDVS7ar8yvzBeNW",
    title: "Circle",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKu0sYFWn4MlTt6EvwrnCI2acbZS7XiUPfHK9k",
    title: "MPP",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKK7E2wSv0acdxFWXVYnmirNehBjOyTHCGISbZ",
    title: "Viem",
  },
];

const rightIcons = [
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKtNwsHTzwqThfYg1GOo5Myv3QZamde6lH9EJk",
    title: "Claude Code",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcK24MeAdmVqnLO1BraJSEoXdxU2bgMD0RwTH84",
    title: "Alchemy",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKRdW8sFAzH1SnIehYbmGJy58oNkfAtv4Z0RLQ",
    title: "Ethereum",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKilOiXyFQiVmRhIesLMZw6pAb4YdnXW3cS9Gf",
    title: "ZeroDev",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKRZCTaiAzH1SnIehYbmGJy58oNkfAtv4Z0RLQ",
    title: "ENS",
  },
  {
    src: "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKdh7cemMW1XVhHYwxBtyD6dpfPmUzgKbuGRsI",
    title: "x402",
  },
];

const logos = [...leftIcons, ...rightIcons];

const LogoOrbitItem = ({
  logo,
  rotation,
  i,
}: {
  logo: (typeof logos)[number];
  i: number;
  rotation: MotionValue<number>;
}) => {
  const baseAngle = (i / logos.length) * 360;
  const angle = useTransform(
    rotation,
    (r) => (r + baseAngle) * (Math.PI / 180),
  );

  const x = useTransform(angle, (a) => Math.cos(a) * 160);
  const y = useTransform(angle, (a) => Math.sin(a) * 160);

  return (
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2"
      key={logo.title}
      style={{
        x,
        y,
      }}
    >
      <motion.div
        className={cn(buttonVariants({ variant: "outline" }), "size-16")}
      >
        <img
          alt={logo.title}
          className="size-8 rounded-lg"
          src={logo.src}
          title={logo.title}
        />
      </motion.div>
    </motion.div>
  );
};

type IconComponentProps = {
  icon: (typeof leftIcons)[number];
  index: number;
};

const IconComponent = ({ icon, index }: IconComponentProps) => {
  const sign = index % 2 === 0 ? -1 : 1;
  const translateY = sign * (80 + (index % 4) * 20);

  const variants = {
    hidden: {
      translateY: translateY,
    },
    visible: {
      translateY: 0,
    },
  };
  return (
    <Tooltip>
      <TooltipTrigger delay={200}>
        <motion.div
          className={cn(
            buttonVariants({ variant: "outline" }),
            "size-16 group",
          )}
          key={icon.title}
          transition={{
            duration: 0.6,
            ease: "easeIn",
          }}
          variants={variants}
        >
          <img
            alt={icon.title}
            className="size-9 rounded-sm transition-transform duration-300 group-hover:scale-100"
            src={icon.src}
            title={icon.title}
          />
        </motion.div>
      </TooltipTrigger>
      <TooltipContent align="center" side="top">
        <p className="text-sm">{icon.title}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const container = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: -100 },
  visible: { opacity: 1, y: 0 },
};

export const Integrate = () => {
  const rotation = useMotionValue(0);

  useEffect(() => {
    const controls = animate(rotation, 360, {
      duration: 20,
      ease: "linear",
      repeat: Number.POSITIVE_INFINITY,
    });

    return () => controls.stop();
  }, [rotation]);

  return (
    <motion.section
      className="relative px-4 py-[12dvh] flex flex-col justify-center gap-12 border bg-[#0F1011] mx-2 rounded-2xl overflow-hidden"
      id="integrate"
      initial="hidden"
      variants={container}
      viewport={{ amount: 0.5, once: true }}
      whileInView="visible"
    >
      <GridOverlay />
      <motion.div
        className="relative flex flex-col gap-3"
        transition={{
          duration: 0.4,
          ease: "easeIn",
        }}
        variants={item}
      >
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          Ecosystem
        </p>
        <motion.h2 className="text-3xl max-w-3xl mx-auto text-center heading-gradient pb-2 sm:text-4xl md:text-5xl tracking-tight">
          Works with your stack
        </motion.h2>
      </motion.div>

      <div className="relative gap-12 py-12 mx-auto lg:flex flex-row hidden items-center">
        <div className="flex flex-row items-center gap-4">
          {leftIcons.map((icon, i) => (
            <IconComponent icon={icon} index={i} key={icon.title} />
          ))}
        </div>
        <div className="relative">
          <div className="relative size-32 border border-white/15 flex items-center justify-center rounded-4xl bg-linear-to-bl from-background from-0% via-background via-70% to-black to-100% mmx-8 shadow-[0_0_40px_rgba(255,255,255,0.05)]">
            <NameraIcon className="size-16 fill-white" />
          </div>
        </div>
        <div className="flex flex-row items-center gap-4">
          {rightIcons.map((icon, i) => (
            <IconComponent icon={icon} index={i} key={icon.title} />
          ))}
        </div>
      </div>

      <div className="relative gap-12 py-[15dvh] mx-auto lg:hidden flex-row flex items-center justify-center">
        {/* Mobile ambient glow */}
        <div
          aria-hidden={true}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="size-72 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)",
            }}
          />
        </div>
        <div className="relative size-32 border border-white/15 flex items-center justify-center rounded-4xl bg-linear-to-bl from-background from-0% via-background via-70% to-black to-100% mmx-8 shadow-[0_0_40px_rgba(255,255,255,0.05)]">
          <NameraIcon className="size-16 fill-white" />
        </div>
        <div className="absolute w-full h-full">
          {logos.map((logo, i) => {
            return (
              <LogoOrbitItem
                i={i}
                key={logo.title}
                logo={logo}
                rotation={rotation}
              />
            );
          })}
        </div>
      </div>
      {/* Supported Networks */}
      <div className="relative flex flex-col items-center gap-4">
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          Supported Networks
        </p>
        <div className="flex items-center justify-center">
          <AvatarGroup>
            {supportedChains.map((chain) => {
              return (
                <Tooltip key={chain.title}>
                  <TooltipTrigger delay={100}>
                    <Avatar className="hover:-translate-y-1 transition-all size-8 sm:size-10.5 bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <chain.icon
                        className="size-7.5 sm:size-9.5 rounded-full"
                        variant="background"
                      />
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p className="text-sm">{chain.title}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </AvatarGroup>
        </div>
      </div>

      <p className="relative mx-auto max-w-6xl px-4 text-center text-muted-foreground md:whitespace-nowrap">
        Use Namera with the tools, chains, and payment systems you already rely
        on.
      </p>
    </motion.section>
  );
};
