import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Chip } from "@namera-ai/ui";

const statusColor = {
  active: "success",
  archived: "default",
  frozen: "warning",
} as const;

type WalletStatusDisplayProps = {
  status: WalletResponse["status"];
};

export function WalletStatusDisplay({ status }: WalletStatusDisplayProps) {
  return (
    <Chip
      color={statusColor[status]}
      size="sm"
      variant="soft"
      className="flex flex-row items-center gap-1 px-2"
    >
      <span aria-hidden className="size-2 rounded-full bg-current" />
      <Chip.Label className="font-normal capitalize">{status}</Chip.Label>
    </Chip>
  );
}

export type { WalletStatusDisplayProps };
