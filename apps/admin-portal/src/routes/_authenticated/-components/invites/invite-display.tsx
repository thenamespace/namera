import { DateTime } from "effect";

import type { BetaInviteStatus } from "@namera-ai/protocol/model";
import { Tooltip } from "@namera-ai/ui";
import {
  HugeiconsIcon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  Clock01Icon,
  TickDouble02Icon,
} from "@namera-ai/ui/icons";

const statuses = {
  active: { label: "Active", icon: CheckmarkCircle02Icon, color: "text-success" },
  redeemed: { label: "Redeemed", icon: TickDouble02Icon, color: "text-accent" },
  revoked: { label: "Revoked", icon: CancelCircleIcon, color: "text-danger" },
  expired: { label: "Expired", icon: Clock01Icon, color: "text-muted" },
};

export function InviteStatus({ status }: { status: BetaInviteStatus }) {
  const presentation = statuses[status];
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <HugeiconsIcon icon={presentation.icon} className={`size-4 shrink-0 ${presentation.color}`} />
      {presentation.label}
    </span>
  );
}

export function InviteDate({ value, label }: { value: DateTime.Utc; label: string }) {
  const fullDate = DateTime.formatLocal(value, { dateStyle: "medium", timeStyle: "short" });
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger
        aria-label={`${label} ${fullDate}`}
        className="text-muted cursor-help text-sm tabular-nums"
      >
        {DateTime.formatLocal(value, { day: "numeric", month: "short", year: "numeric" })}
      </Tooltip.Trigger>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        {fullDate}
      </Tooltip.Content>
    </Tooltip>
  );
}
