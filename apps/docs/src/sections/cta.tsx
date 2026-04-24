import { Link } from "@tanstack/react-router";

import { Button, buttonVariants } from "@namera-ai/ui/components/ui/button";
import { ButtonGroup } from "@namera-ai/ui/components/ui/button-group";
import { cn } from "@namera-ai/ui/lib/utils";
import { ArrowRight, CheckIcon, CopyIcon } from "lucide-react";
import { motion, type Variants } from "motion/react";

import { AmbientGlow, Hr } from "@/components/misc";
import { useCopyToClipboard } from "@/hooks/misc";

const steps = [
  { key: "create", label: "Smart Wallets" },
  { key: "access", label: "Session Keys" },
  { key: "control", label: "Policies" },
  { key: "execute", label: "Agents" },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.1, staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    y: 0,
  },
};

const stepVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export const Cta = () => {
  const { copied, copy } = useCopyToClipboard();

  return (
    <motion.section
      className="relative mx-auto flex max-w-7xl flex-col items-center gap-14 px-4 py-[12dvh] text-center"
      id="cta"
      initial="hidden"
      viewport={{ margin: "-100px", once: true }}
      whileInView="visible"
    >
      <Hr />
      <AmbientGlow />
      <motion.div
        className="flex flex-wrap items-center justify-center gap-y-3"
        variants={containerVariants}
      >
        {steps.map((step, i) => (
          <motion.div
            className="flex items-center"
            key={step.key}
            variants={stepVariants}
          >
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-5 py-2.5 backdrop-blur-sm">
              <span className="font-geist-mono text-sm font-medium text-white/80">
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center px-2">
                <div className="h-px w-6 bg-gradient-to-r from-white/40 to-white/20" />
                <div
                  aria-hidden={true}
                  className="h-1 w-1 rotate-45 border-r border-t border-white/40"
                />
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Heading */}
      <motion.div className="flex flex-col gap-4" variants={itemVariants}>
        <h2 className="heading-gradient mx-auto max-w-2xl pb-2 text-4xl tracking-tight sm:text-5xl md:text-6xl">
          Start building.
        </h2>
        <p className="mx-auto max-w-md text-sm font-normal leading-relaxed text-muted-foreground md:text-base">
          Smart accounts, session keys, and onchain policies - all in one place,
          ready for agents.
        </p>
      </motion.div>

      {/* CTAs */}
      <motion.div variants={itemVariants}>
        <ButtonGroup className="max-w-full overflow-x-auto">
          <span
            className={cn(
              buttonVariants({ size: "xl", variant: "outline" }),
              "rounded-r-none hover:bg-background! hover:text-muted-foreground rounded-l-xl",
            )}
          >
            Get Started
          </span>
          <Button
            className="rounded-none"
            onClick={() => copy("npm i -g @namera-ai/cli")}
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
            className="rounded-xl rounded-l-none group pr-4"
            render={<Link to="/docs/$" />}
            size="xl"
            variant="outline"
          >
            Docs
            <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-all" />
          </Button>
        </ButtonGroup>
      </motion.div>
    </motion.section>
  );
};
