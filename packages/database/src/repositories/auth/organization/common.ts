// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Schema } from "effect";

import { OrganizationRole, SystemRole } from "@namera-ai/protocol/model";

import type {
  organizationRole as organizationRoleTable,
  systemRole as systemRoleTable,
} from "#/schema/index";

export type OrganizationRoleRow = typeof organizationRoleTable.$inferSelect;
export type SystemRoleRow = typeof systemRoleTable.$inferSelect;

export type JoinedOrganizationRole = OrganizationRoleRow & {
  systemRole: SystemRoleRow | null;
};

export const decodeOrganizationRole = (
  organizationRole: OrganizationRoleRow,
  systemRole?: SystemRoleRow | null,
): OrganizationRole => {
  const decodedRole = Schema.decodeSync(OrganizationRole)(organizationRole as any);

  if (decodedRole.type !== "system" || systemRole === null) {
    return decodedRole;
  }

  const decodedSystemRole = Schema.decodeSync(SystemRole)(systemRole as any);

  return Schema.decodeSync(OrganizationRole)({
    ...decodedRole,
    key: decodedSystemRole.key,
    metadata: decodedSystemRole.metadata,
    permissions: decodedSystemRole.permissions,
  } as any);
};

export const decodeJoinedOrganizationRole = (
  joinedRole: JoinedOrganizationRole,
): OrganizationRole => {
  const { systemRole, ...organizationRole } = joinedRole;

  return decodeOrganizationRole(organizationRole, systemRole);
};
