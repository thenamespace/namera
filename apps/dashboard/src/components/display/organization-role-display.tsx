import type { GetOrganizationRoleResponse } from "@namera-ai/protocol/dto";
import { Chip } from "@namera-ai/ui";

type OrganizationRoleDisplayProps = {
  role: GetOrganizationRoleResponse;
};

export function OrganizationRoleDisplay({ role }: OrganizationRoleDisplayProps) {
  return (
    <Chip color={role.key === "owner" ? "accent" : "default"} size="sm" variant="soft">
      <Chip.Label className="font-normal">{role.metadata.name}</Chip.Label>
    </Chip>
  );
}

export type { OrganizationRoleDisplayProps };
