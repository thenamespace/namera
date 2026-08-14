import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Chip } from "@namera-ai/ui";

type WalletProtectionDisplayProps = {
  protectionLevel: WalletResponse["protectionLevel"];
};

export function WalletProtectionDisplay({ protectionLevel }: WalletProtectionDisplayProps) {
  return (
    <Chip color={protectionLevel === "hsm" ? "accent" : "default"} size="md" variant="soft">
      <Chip.Label className="font-normal uppercase">{protectionLevel}</Chip.Label>
    </Chip>
  );
}

export type { WalletProtectionDisplayProps };
