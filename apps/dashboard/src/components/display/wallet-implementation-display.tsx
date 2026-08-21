import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";
import { AlchemyIcon } from "@namera-ai/ui/icons";

type WalletImplementationDisplayProps = {
  implementation: WalletResponse["implementation"];
};

export function WalletImplementationDisplay({ implementation }: WalletImplementationDisplayProps) {
  const label = implementation === "alchemy-modular-v2" ? "Alchemy Modular V2" : implementation;

  return (
    <div className="flex items-center gap-2">
      <AlchemyIcon aria-hidden className="size-4 shrink-0" />
      <Typography className="text-sm!" weight="normal">
        {label}
      </Typography>
    </div>
  );
}

export type { WalletImplementationDisplayProps };
