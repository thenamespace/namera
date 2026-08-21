import type { ReactNode } from "react";

import { cn } from "@namera-ai/ui";
import { HugeiconsIcon, type IconSvgElement } from "@namera-ai/ui/icons";

type StatusTone = "accent" | "danger" | "muted" | "success" | "warning";

type StatusDisplayProps = {
  icon: IconSvgElement;
  label: ReactNode;
  tone?: StatusTone;
};

const toneClassNames: Record<StatusTone, string> = {
  accent: "text-accent",
  danger: "text-danger",
  muted: "text-muted",
  success: "text-success",
  warning: "text-warning",
};

export function StatusDisplay({ icon, label, tone = "muted" }: StatusDisplayProps) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
      <span
        className={cn("flex size-4 shrink-0 items-center justify-center", toneClassNames[tone])}
      >
        <HugeiconsIcon className="size-4" icon={icon} />
      </span>
      <span className="truncate text-foreground">{label}</span>
    </span>
  );
}

export type { StatusDisplayProps, StatusTone };
