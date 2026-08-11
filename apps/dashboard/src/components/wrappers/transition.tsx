import type { PropsWithChildren } from "react";

import { cn } from "@namera-ai/ui";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";

type TransitionWrapperProps = PropsWithChildren<{
  className?: string;
  stepKey: string;
}>;

const transition: Transition = {
  type: "tween",
  ease: "easeIn",
  duration: 0.15,
};

const reducedTransition = { duration: 0 } as const;
const visible = { opacity: 1, y: 0 } as const;
const enter = { opacity: 0, y: 6 } as const;
const leave = { opacity: 0, y: -4 } as const;

export function TransitionWrapper({ children, className, stepKey }: TransitionWrapperProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        animate={visible}
        className={cn("w-full", className)}
        exit={shouldReduceMotion ? visible : leave}
        initial={shouldReduceMotion ? false : enter}
        key={stepKey}
        transition={shouldReduceMotion ? reducedTransition : transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
