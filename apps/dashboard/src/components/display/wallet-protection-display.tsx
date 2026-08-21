import type { WalletResponse } from "@namera-ai/protocol/dto";
import { ComputerIcon, SecurityKeyUsbIcon } from "@namera-ai/ui/icons";

import { StatusDisplay } from "./status-display";

type WalletProtectionDisplayProps = {
  protectionLevel: WalletResponse["protectionLevel"];
};

export function WalletProtectionDisplay({ protectionLevel }: WalletProtectionDisplayProps) {
  const presentation =
    protectionLevel === "hsm"
      ? { icon: SecurityKeyUsbIcon, label: "HSM", tone: "accent" as const }
      : { icon: ComputerIcon, label: "Software", tone: "muted" as const };

  return (
    <StatusDisplay icon={presentation.icon} label={presentation.label} tone={presentation.tone} />
  );
}

export type { WalletProtectionDisplayProps };
