import { MemberPermission, type SystemRoleInsert } from "@namera-ai/protocol/model";

const memberPermissions = [
  "member:read",
  "member:update",
  "member:remove",
] as const satisfies ReadonlyArray<MemberPermission>;

const invitationPermissions = [
  "invitation:read",
  "invitation:create",
  "invitation:cancel",
] as const satisfies ReadonlyArray<MemberPermission>;

const rolePermissions = [
  "role:read",
  "role:create",
  "role:update",
  "role:delete",
] as const satisfies ReadonlyArray<MemberPermission>;

const walletPermissions = [
  "wallet:read",
  "wallet:create",
  "wallet:update",
] as const satisfies ReadonlyArray<MemberPermission>;

const sessionKeyPermissions = [
  "session-key:read",
  "session-key:create",
  "session-key:revoke",
] as const satisfies ReadonlyArray<MemberPermission>;

const apiKeyPermissions = [
  "api-key:read",
  "api-key:create",
  "api-key:revoke",
] as const satisfies ReadonlyArray<MemberPermission>;

const executionPermissions = ["execution:read"] as const satisfies ReadonlyArray<MemberPermission>;

export const systemRoles = [
  {
    key: "owner",
    metadata: {
      version: 1,
      name: "Owner",
      description: "Organization owner with full access",
    },
    permissions: MemberPermission.literals,
  },
  {
    key: "admin",
    metadata: {
      version: 1,
      name: "Admin",
      description: "Organization administrator",
    },
    permissions: [
      "organization:read",
      "organization:update",
      ...memberPermissions,
      ...invitationPermissions,
      ...rolePermissions,
      "billing:read",
      ...walletPermissions,
      ...sessionKeyPermissions,
      ...apiKeyPermissions,
      ...executionPermissions,
    ],
  },
  {
    key: "member",
    metadata: {
      version: 1,
      name: "Member",
      description: "Organization member with read access",
    },
    permissions: [
      "organization:read",
      "member:read",
      "role:read",
      "wallet:read",
      "session-key:read",
      "api-key:read",
      ...executionPermissions,
    ],
  },
] as const satisfies ReadonlyArray<SystemRoleInsert>;
