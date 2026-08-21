import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { CancelCircleIcon, CheckmarkCircle02Icon } from "@namera-ai/ui/icons";

import { StatusDisplay } from "./status-display";

type SessionKeyStatusDisplayProps = {
  status: SessionKeyResponse["status"];
};

export function SessionKeyStatusDisplay({ status }: SessionKeyStatusDisplayProps) {
  return status === "active" ? (
    <StatusDisplay icon={CheckmarkCircle02Icon} label="Active" tone="success" />
  ) : (
    <StatusDisplay icon={CancelCircleIcon} label="Revoked" tone="danger" />
  );
}

export type { SessionKeyStatusDisplayProps };
