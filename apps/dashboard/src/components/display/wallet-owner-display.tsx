import type { WalletKeyProtectionLevel } from "@namera-ai/protocol/model";
import { BrandOneClawIcon, ComputerIcon, SecurityKeyUsbIcon } from "@namera-ai/ui/icons";

import { StatusDisplay } from "./status-display";

type WalletOwnerDisplayProps = {
  custody: "local" | "namera-managed";
  protectionLevel?: WalletKeyProtectionLevel | undefined;
  provider?: string | undefined;
};

export function WalletOwnerDisplay({
  custody,
  protectionLevel,
  provider,
}: WalletOwnerDisplayProps) {
  if (custody === "local") {
    return <StatusDisplay icon={ComputerIcon} label="User-owned passkey" tone="muted" />;
  }
  if (provider === "1claw") {
    return (
      <span className="inline-flex min-w-0 items-center gap-2 text-sm">
        <BrandOneClawIcon aria-hidden className="size-4 shrink-0" />
        <span className="truncate text-foreground">1Claw Managed</span>
      </span>
    );
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
