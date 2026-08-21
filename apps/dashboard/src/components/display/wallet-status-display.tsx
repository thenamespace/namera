import type { WalletResponse } from "@namera-ai/protocol/dto";
import { ArchiveIcon, CheckmarkCircle02Icon, SnowIcon } from "@namera-ai/ui/icons";

import { StatusDisplay } from "./status-display";

const statusPresentation = {
  active: { icon: CheckmarkCircle02Icon, label: "Active", tone: "success" as const },
  archived: { icon: ArchiveIcon, label: "Archived", tone: "muted" as const },
  frozen: { icon: SnowIcon, label: "Frozen", tone: "warning" as const },
} as const satisfies Record<
  WalletResponse["status"],
  { icon: typeof CheckmarkCircle02Icon; label: string; tone: "muted" | "success" | "warning" }
>;

type WalletStatusDisplayProps = {
  status: WalletResponse["status"];
};

export function WalletStatusDisplay({ status }: WalletStatusDisplayProps) {
  const presentation = statusPresentation[status];
  return <StatusDisplay {...presentation} />;
}

export type { WalletStatusDisplayProps };
