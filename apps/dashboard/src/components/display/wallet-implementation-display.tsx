import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";
import { KernelIcon, SafeWalletIcon } from "@namera-ai/ui/icons";

type WalletImplementationDisplayProps = {
  implementation: WalletResponse["implementation"];
};

export function WalletImplementationDisplay({ implementation }: WalletImplementationDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      {implementation === "kernel" ? (
        <KernelIcon aria-hidden className="size-4 shrink-0" />
      ) : (
        <SafeWalletIcon aria-hidden className="size-4 shrink-0" />
      )}
      <Typography className="text-sm! capitalize" weight="normal">
        {implementation}
      </Typography>
    </div>
  );
}

export type { WalletImplementationDisplayProps };
