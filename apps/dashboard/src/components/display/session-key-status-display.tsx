import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { Chip } from "@namera-ai/ui";

type SessionKeyStatusDisplayProps = {
  status: SessionKeyResponse["status"];
};

export function SessionKeyStatusDisplay({ status }: SessionKeyStatusDisplayProps) {
  return (
    <Chip color={status === "active" ? "success" : "default"} size="sm" variant="soft">
      <span aria-hidden className="size-2 rounded-full bg-current" />
      <Chip.Label className="font-normal capitalize">{status}</Chip.Label>
    </Chip>
  );
}

export type { SessionKeyStatusDisplayProps };
