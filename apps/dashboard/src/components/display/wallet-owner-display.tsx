import type { WalletKeyProtectionLevel } from "@namera-ai/protocol/model";
import { ComputerIcon, SecurityKeyUsbIcon } from "@namera-ai/ui/icons";

import { StatusDisplay } from "./status-display";

type WalletOwnerDisplayProps = {
  custody: "local" | "namera-managed";
  protectionLevel?: WalletKeyProtectionLevel | undefined;
};

export function WalletOwnerDisplay({ custody, protectionLevel }: WalletOwnerDisplayProps) {
  if (custody === "local") {
    return <StatusDisplay icon={ComputerIcon} label="User-owned passkey" tone="muted" />;
  }

  return (
    <StatusDisplay
      icon={SecurityKeyUsbIcon}
      label={
        protectionLevel === undefined
          ? "Namera managed"
          : protectionLevel === "hsm"
            ? "Namera managed · HSM"
            : "Namera managed · Software"
      }
      tone="muted"
    />
  );
}

export type { WalletOwnerDisplayProps };
