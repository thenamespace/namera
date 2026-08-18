import type { OAuthAuthorizationStatus } from "@namera-ai/protocol/model";
import { Chip } from "@namera-ai/ui";

type OAuthAuthorizationStatusDisplayProps = {
  status: OAuthAuthorizationStatus;
};

export function OAuthAuthorizationStatusDisplay({ status }: OAuthAuthorizationStatusDisplayProps) {
  return (
    <Chip color={status === "active" ? "success" : "default"} size="sm" variant="soft">
      <Chip.Label className="font-normal capitalize">{status}</Chip.Label>
    </Chip>
  );
}

export type { OAuthAuthorizationStatusDisplayProps };
