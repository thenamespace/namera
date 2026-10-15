import { DateTime } from "effect";

import type { BetaInviteStatus } from "@namera-ai/protocol/model";
import { StatusDisplay, Tooltip } from "@namera-ai/ui";
import {
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  Clock01Icon,
  TickDouble02Icon,
} from "@namera-ai/ui/icons";

const statuses = {
  active: { label: "Active", icon: CheckmarkCircle02Icon, tone: "success" },
  redeemed: { label: "Redeemed", icon: TickDouble02Icon, tone: "accent" },
  revoked: { label: "Revoked", icon: CancelCircleIcon, tone: "danger" },
  expired: { label: "Expired", icon: Clock01Icon, tone: "muted" },
} as const;

export function InviteStatus({ status }: { status: BetaInviteStatus }) {
  const presentation = statuses[status];
  return <StatusDisplay {...presentation} />;
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
