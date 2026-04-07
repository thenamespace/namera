import type { ComponentProps } from "react";

import {
  AnimatePresence,
  type HTMLMotionProps,
  motion,
  type Transition,
  type Variants,
} from "motion/react";

import { cn } from "@namera-ai/ui/lib/utils";

const springConfig: Transition = {
  damping: 30,
  mass: 0.8,
  stiffness: 400,
  type: "spring",
};

const variants: Variants = {
  animate: {
    filter: "blur(0px)",
    opacity: 1,
    scale: 1,
    transition: {
      damping: 30,
      mass: 0.8,
      staggerChildren: 0.05,
      stiffness: 400,
      type: "spring",
    },
    y: 0,
  },
  exit: {
    filter: "blur(1px)",
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.15, ease: "easeOut" },
    y: -4,
  },
  initial: {
    filter: "blur(1px)",
    opacity: 0,
    scale: 0.98,
    y: 8,
  },
};

type TransitionWrapperProps = ComponentProps<"div"> &
  HTMLMotionProps<"div"> & {
    stepKey: string;
  };

export const TransitionWrapper = ({
  children,
  stepKey,
  className,
  ...props
}: TransitionWrapperProps) => {
  return (
    <motion.div
      className={cn("relative overflow-hidden", className)}
      layout={true}
      transition={springConfig}
      {...props}
    >
      <AnimatePresence mode="wait">
        <motion.div
          animate="animate"
          className="h-full w-full"
          exit="exit"
          initial="initial"
          key={stepKey}
          variants={variants}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
