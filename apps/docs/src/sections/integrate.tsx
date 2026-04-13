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
        className="size-16 rounded-2xl border flex items-center justify-center"
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
    <Tooltip>
      <TooltipTrigger>
        <motion.div
          className="size-16 rounded-2xl border flex items-center justify-center"
          key={icon.title}
          transition={{
            duration: 0.6,
            ease: "easeIn",
          }}
          variants={variants}
        >
          <img
            alt={icon.title}
            className="size-9 rounded-sm"
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
      className="px-4 py-[10dvh] flex flex-col justify-center gap-12 border bg-[#0F1011] mx-1 rounded-lg overflow-hidden"
      id="integrate"
      initial="hidden"
      variants={container}
      viewport={{ amount: 0.5, once: false }}
      whileInView="visible"
    >
      <motion.h2
        className="text-3xl max-w-3xl mx-auto text-center heading-gradient pb-2 sm:text-4xl md:text-5xl"
        transition={{
          duration: 0.2,
          ease: "easeIn",
        }}
        variants={item}
      >
        Works with your stack
      </motion.h2>
      <div className="gap-12 py-12 mx-auto lg:flex flex-row hidden">
        <div className="flex flex-row items-center gap-4">
          {leftIcons.map((icon, i) => (
            <IconComponent icon={icon} index={i} key={icon.title} />
          ))}
        </div>
        <div className="size-32 border flex items-center justify-center rounded-4xl bg-linear-to-bl from-background from-0% via-background via-70% to-black to-100% mmx-8">
          <NameraIcon className="size-16 fill-white" />
        </div>
        <div className="flex flex-row items-center gap-4">
          {rightIcons.map((icon, i) => (
            <IconComponent icon={icon} index={i} key={icon.title} />
          ))}
        </div>
      </div>
      <div className="gap-12 py-[15dvh] mx-auto lg:hidden flex-row flex relative items-center justify-center">
        <div className="size-32 border flex items-center justify-center rounded-4xl bg-linear-to-bl from-background from-0% via-background via-70% to-black to-100% mmx-8">
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
      <p className="text-center text-muted-foreground">
        Use Namera with the tools, chains, and payment systems you already rely
        on
      </p>
    </motion.section>
  );
};
