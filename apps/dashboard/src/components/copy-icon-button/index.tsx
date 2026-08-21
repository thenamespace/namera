import { useEffect, useRef, useState } from "react";

import { Button, cn, Dropdown, Label, Tooltip } from "@namera-ai/ui";
import { CheckIcon, Copy01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEventCallback } from "usehooks-ts";

import { writeClipboardText } from "@/lib/clipboard";

type CopyIconButtonProps = {
  label: string;
  value: string;
  className?: string;
  onCopyError?: () => void;
  onCopySuccess?: () => void;
};

type CopyDropdownItemProps = {
  id: string;
  label: string;
  value: string;
  onCopyError?: () => void;
  onCopySuccess?: () => void;
};

const copiedDuration = 3500;
const visibleIcon = { filter: "blur(0px)", opacity: 1, scale: 1 } as const;
const hiddenIcon = { filter: "blur(3px)", opacity: 0, scale: 0.85 } as const;
const motionTransition = { duration: 0.16, ease: "easeOut" } as const;
const reducedTransition = { duration: 0 } as const;

function useCopyFeedback({
  value,
  onCopyError,
  onCopySuccess,
}: {
  value: string;
  onCopyError: (() => void) | undefined;
  onCopySuccess: (() => void) | undefined;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = useEventCallback(() => {
    void (async () => {
      const copied = await writeClipboardText(value);
      if (copied) {
        setIsCopied(true);
        onCopySuccess?.();
        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsCopied(false), copiedDuration);
      } else {
        onCopyError?.();
      }
    })();
  });

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return { copy, isCopied };
}

function CopyFeedbackIcon({ isCopied, className }: { isCopied: boolean; className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.span
        animate={visibleIcon}
        className={cn("flex items-center justify-center", className)}
        exit={shouldReduceMotion ? visibleIcon : hiddenIcon}
        initial={shouldReduceMotion ? false : hiddenIcon}
        key={isCopied ? "copied" : "copy"}
        transition={shouldReduceMotion ? reducedTransition : motionTransition}
      >
        <HugeiconsIcon icon={isCopied ? CheckIcon : Copy01Icon} />
      </motion.span>
    </AnimatePresence>
  );
}

export function CopyIconButton({
  label,
  value,
  className,
  onCopyError,
  onCopySuccess,
}: CopyIconButtonProps) {
  const { copy, isCopied } = useCopyFeedback({ value, onCopyError, onCopySuccess });

  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger>
        <Button
          aria-label={isCopied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
          className={cn("relative shrink-0", className) ?? "relative shrink-0"}
          isIconOnly
          size="sm"
          type="button"
          variant="tertiary"
          onPress={copy}
        >
          <CopyFeedbackIcon isCopied={isCopied} />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        {isCopied ? "Copied" : `Copy ${label.toLowerCase()}`}
      </Tooltip.Content>
    </Tooltip>
  );
}

export function CopyDropdownItem({
  id,
  label,
  value,
  onCopyError,
  onCopySuccess,
}: CopyDropdownItemProps) {
  const { copy, isCopied } = useCopyFeedback({ value, onCopyError, onCopySuccess });

  return (
    <Dropdown.Item id={id} shouldCloseOnSelect={false} textValue={label} onAction={copy}>
      <CopyFeedbackIcon
        className={isCopied ? "size-4 text-success" : "size-4 text-muted"}
        isCopied={isCopied}
      />
      <Label>{label}</Label>
    </Dropdown.Item>
  );
}

export type { CopyDropdownItemProps, CopyIconButtonProps };
