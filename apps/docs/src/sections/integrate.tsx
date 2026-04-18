import { useEffect } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@namera-ai/ui/components/ui/tooltip";
import { NameraIcon } from "@namera-ai/ui/icons";
import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";

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
        className="size-16 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm flex items-center justify-center shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]"
        style={{}}
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
    <Tooltip delay={0}>
      <TooltipTrigger>
        <motion.div
          className="group size-16 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm flex items-center justify-center transition-all duration-300 ease-out hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06] hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.8)]"
          key={icon.title}
          transition={{
            duration: 0.6,
            ease: "easeIn",
          }}
          variants={variants}
        >
          <img
            alt={icon.title}
            className="size-9 rounded-sm transition-transform duration-300 group-hover:scale-110"
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
      className="relative px-4 py-[12dvh] flex flex-col justify-center gap-12 border border-white/10 bg-[#0F1011] mx-4 sm:mx-6 rounded-2xl overflow-hidden"
      id="integrate"
      initial="hidden"
      variants={container}
      viewport={{ amount: 0.5, once: false }}
      whileInView="visible"
    >
      {/* Subtle grid pattern overlay */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 80%)",
        }}
      />
      {/* Ambient glow */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto max-w-3xl h-64 blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,255,255,0.12), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-3">
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          Ecosystem
        </p>
        <motion.h2
          className="text-3xl max-w-3xl mx-auto text-center heading-gradient pb-2 sm:text-4xl md:text-5xl tracking-tight"
          transition={{
            duration: 0.2,
            ease: "easeIn",
          }}
          variants={item}
        >
          Works with your stack
        </motion.h2>
      </div>

      <div className="relative gap-12 py-12 mx-auto lg:flex flex-row hidden items-center">
        <div className="flex flex-row items-center gap-4">
          {leftIcons.map((icon, i) => (
            <IconComponent icon={icon} index={i} key={icon.title} />
          ))}
        </div>
        <div className="relative">
          {/* Radial gradient glow behind Namera logo */}
          <div
            aria-hidden={true}
            className="pointer-events-none absolute -inset-10 blur-2xl"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)",
            }}
          />
          {/* Pulsing ring */}
          <div
            aria-hidden={true}
            className="pointer-events-none absolute inset-0 rounded-4xl border border-white/10 animate-pulse"
          />
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
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 backdrop-blur-sm">
            <img
              alt="Ethereum"
              className="size-3.5 rounded-sm"
              src="https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKRdW8sFAzH1SnIehYbmGJy58oNkfAtv4Z0RLQ"
            />
            <span>Ethereum</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 backdrop-blur-sm">
            <img
              alt="Base"
              className="size-3.5 rounded-sm"
              src="https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcK3je8iYsgdt63Nik9WJIYpTSPrqZ450EzjOwy"
            />
            <span>Base</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 backdrop-blur-sm">
            <span>Polygon</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 backdrop-blur-sm">
            <span>Arbitrum</span>
          </div>
        </div>
      </div>

      <p className="relative mx-auto max-w-6xl px-4 text-center text-muted-foreground md:whitespace-nowrap">
        Use Namera with the tools, chains, and payment systems you already rely
        on.
      </p>
    </motion.section>
  );
};
