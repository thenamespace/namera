import type { MemberPermission, OrganizationRole } from "@namera-ai/protocol/model";

export type OrganizationRoleAuthority = Pick<OrganizationRole, "key" | "permissions" | "type">;

const includesAllPermissions = (
  granted: ReadonlyArray<MemberPermission>,
  required: ReadonlyArray<MemberPermission>,
) => required.every((permission) => granted.includes(permission));

const hasStrictlyMorePermissions = (
  actorRole: OrganizationRoleAuthority,
  targetRole: OrganizationRoleAuthority,
) =>
  includesAllPermissions(actorRole.permissions, targetRole.permissions) &&
  actorRole.permissions.some((permission) => !targetRole.permissions.includes(permission));

export const canAssignOrganizationRole = (
  actorRole: OrganizationRoleAuthority,
  assignedRole: OrganizationRoleAuthority,
) => {
  if (assignedRole.type === "system" && assignedRole.key === "owner") return false;
  return hasStrictlyMorePermissions(actorRole, assignedRole);
};

export const canManageOrganizationRole = (
  actorRole: OrganizationRoleAuthority,
  targetRole: OrganizationRoleAuthority,
) =>
  !(targetRole.type === "system" && targetRole.key === "owner") &&
  hasStrictlyMorePermissions(actorRole, targetRole);
