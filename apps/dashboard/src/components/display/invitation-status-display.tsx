import type { GetInvitationResponse } from "@namera-ai/protocol/dto";
import { CancelCircleIcon, CheckmarkCircle02Icon, Clock01Icon } from "@namera-ai/ui/icons";

import { StatusDisplay, type StatusTone } from "./status-display";

type InvitationStatus = GetInvitationResponse["invitation"]["status"];

const statusPresentation: Record<
  InvitationStatus,
  { icon: typeof Clock01Icon; label: string; tone: StatusTone }
> = {
  pending: { icon: Clock01Icon, label: "Pending", tone: "warning" },
  accepted: { icon: CheckmarkCircle02Icon, label: "Accepted", tone: "success" },
  rejected: { icon: CancelCircleIcon, label: "Rejected", tone: "danger" },
  canceled: { icon: CancelCircleIcon, label: "Canceled", tone: "muted" },
  expired: { icon: Clock01Icon, label: "Expired", tone: "muted" },
};

export function InvitationStatusDisplay({ status }: { status: InvitationStatus }) {
  const presentation = statusPresentation[status];

  return (
    <StatusDisplay icon={presentation.icon} label={presentation.label} tone={presentation.tone} />
  );
}

export type { InvitationStatus };
