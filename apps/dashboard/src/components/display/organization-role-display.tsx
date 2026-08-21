import type { GetOrganizationRoleResponse } from "@namera-ai/protocol/dto";
import { CrownIcon, UserIcon, UserShield01Icon } from "@namera-ai/ui/icons";

import { StatusDisplay } from "./status-display";

type OrganizationRoleDisplayProps = {
  role: GetOrganizationRoleResponse;
};

export function OrganizationRoleDisplay({ role }: OrganizationRoleDisplayProps) {
  const presentation =
    role.key === "owner"
      ? { icon: CrownIcon, tone: "accent" as const }
      : role.key === "admin"
        ? { icon: UserShield01Icon, tone: "warning" as const }
        : { icon: UserIcon, tone: "muted" as const };

  return (
    <StatusDisplay icon={presentation.icon} label={role.metadata.name} tone={presentation.tone} />
  );
}

export type { OrganizationRoleDisplayProps };
