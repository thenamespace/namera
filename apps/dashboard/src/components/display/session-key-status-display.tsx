import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { CancelCircleIcon, CheckmarkCircle02Icon, Clock01Icon } from "@namera-ai/ui/icons";

import { StatusDisplay, type StatusDisplayProps } from "./status-display";

type SessionKeyStatusDisplayProps = {
  status: SessionKeyResponse["status"];
};

const statusDefinitions = {
  pending: { icon: Clock01Icon, label: "Pending", tone: "warning" },
  active: { icon: CheckmarkCircle02Icon, label: "Active", tone: "success" },
  revoking: { icon: CancelCircleIcon, label: "Revoked", tone: "danger" },
  revoked: { icon: CancelCircleIcon, label: "Revoked", tone: "danger" },
} satisfies Record<SessionKeyResponse["status"], StatusDisplayProps>;

export function SessionKeyStatusDisplay({ status }: SessionKeyStatusDisplayProps) {
  return <StatusDisplay {...statusDefinitions[status]} />;
}

export function sessionKeyDisplayStatus(status: SessionKeyResponse["status"]) {
  return status === "revoking" ? "revoked" : status;
}

export type { SessionKeyStatusDisplayProps };
