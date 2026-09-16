import { useState } from "react";

import { Icon, PlusSignIcon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export type AccordionItem = {
  readonly q: string;
  readonly a: string;
};

/**
 * A list of questions, one open at a time. Used by the home page FAQ and the
 * pricing page, which is why it lives here rather than inside either of them.
 *
 * `idPrefix` keeps the button and panel ids unique when two of these end up on
 * the same document.
 */
export const Accordion = ({
  items,
  idPrefix,
  openFirst = true,
}: {
  readonly items: readonly AccordionItem[];
  readonly idPrefix: string;
  readonly openFirst?: boolean;
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(openFirst ? 0 : null);
  const reduced = useReducedMotion();

  return (
    <ul className="flex flex-col border-t-1 border-border">
      {items.map((item, index) => {
        const open = openIndex === index;
        const panelId = `${idPrefix}-panel-${String(index)}`;
        const buttonId = `${idPrefix}-question-${String(index)}`;
        return (
          <li key={item.q} className="border-b-1 border-border">
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => {
                  setOpenIndex(open ? null : index);
                }}
                className={cn(
                  "tap-target group/q flex w-full items-start gap-6 py-6 text-left md:py-7",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus/60",
                )}
              >
                <span
                  className={cn(
                    "flex-1 text-[1rem] font-medium tracking-[-0.015em] transition-colors duration-150 ease-out-quad md:text-[1.0625rem]",
                    open ? "text-foreground" : "text-muted group-hover/q:text-foreground",
                  )}
                >
                  {item.q}
                </span>
                <Icon
                  icon={PlusSignIcon}
                  aria-hidden
                  strokeWidth={1.8}
                  className={cn(
                    "mt-1 size-4 shrink-0 text-ink-subtle transition-transform duration-250 ease-out-quad",
                    open && "rotate-45",
                  )}
                />
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {open ? (
                <motion.section
                  key="answer"
                  id={panelId}
                  aria-labelledby={buttonId}
                  initial={{ height: reduced ? "auto" : 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: reduced ? "auto" : 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="overflow-hidden"
                >
                  <p className="type-body max-w-[72ch] pr-8 pb-7 text-pretty text-muted">
                    {item.a}
                  </p>
                </motion.section>
              ) : null}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
};
