import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";

type NamespaceDisplayProps = {
  namespace: WalletResponse["namespace"];
};

export function NamespaceDisplay({ namespace }: NamespaceDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      <ChainIcon aria-hidden className="size-4 shrink-0" chain="ethereum" namespace={namespace} />
      <Typography className="text-sm!" weight="normal">
        EVM
      </Typography>
    </div>
  );
}

export type { NamespaceDisplayProps };
