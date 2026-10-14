import type { OAuthAuthorizationStatus } from "@namera-ai/protocol/model";
import { StatusDisplay } from "@namera-ai/ui";
import { CancelCircleIcon, CheckmarkCircle02Icon } from "@namera-ai/ui/icons";

type OAuthAuthorizationStatusDisplayProps = {
  status: OAuthAuthorizationStatus;
};

export function OAuthAuthorizationStatusDisplay({ status }: OAuthAuthorizationStatusDisplayProps) {
  return (
    <StatusDisplay
      icon={status === "active" ? CheckmarkCircle02Icon : CancelCircleIcon}
      label={status === "active" ? "Active" : "Revoked"}
      tone={status === "active" ? "success" : "danger"}
    />
  );
}

export type { OAuthAuthorizationStatusDisplayProps };
