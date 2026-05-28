import { Schema } from "effect";

import type { SystemRoleInsert } from "./system-role";

// Organization Permissions
const orgPermissions = [
  "org:read", // Read Organization details such as name, slug, etc.
  "org:update", // Update Organization details such as name, slug, etc.
  "org:delete", // Delete an organization
] as const;

// Billing Permissions
const billingPermissions = [
  "billing:read", // Read Organization Billing details such as plan, etc.
  "billing:update", // Update Organization Billing details through payment gateway, upgrade plan, etc.
  "billing:cancel", // Cancel Organization Billing
] as const;

// Member Permissions
const memberPermissions = [
  "member:read", // Read list of all members in an organization
  "member:update", // Update a member's role
  "member:remove", // Remove a member from an organization
] as const;

// Role Permissions
const rolePermissions = [
  "role:read", // Read all roles in an organization
  "role:create", // Create a role in an organization
  "role:update", // Update existing role in an organization
  "role:delete", // Delete a role in an organization
] as const;

// Invitation Permissions
const invitationPermissions = [
  "invitation:read", // Read Organization Pending and Past invitations
  "invitation:create", // Invite a user to an organization
  "invitation:update", // Update an invitation, such as revoking it, changing the role, etc.
  "invitation:delete", // Delete an invitation
] as const;

// Smart Account Permissions
const smartAccountPermissions = [
  "smart_account:read", // Read all smart accounts in the org.
  "smart_account:create", // Create a new Smart Account in org.
  "smart_account:update", // Update Smart Account Metadata such as logo, name, description.
  "smart_account:delete", // Delete a smart account
  "smart_account:execute_tx", // Execute Transactions from smart account.
] as const;

// Session Key Permissions
const sessionKeyPermissions = [
  "session_key:read", // Read all Session Keys in an org
  "session_key:create", // Create session keys
  "session_key:update", // Update Session key metadata, name, description
  "session_key:delete", // Delete Session Key
  "session_key:revoke", // Revoke Session Keys
  "session_key:execute_tx", // Execute Transactions from session keys
] as const;

export const MemberPermission = Schema.Literals([
  ...orgPermissions,
  ...billingPermissions,
  ...memberPermissions,
  ...rolePermissions,
  ...invitationPermissions,
  ...smartAccountPermissions,
  ...sessionKeyPermissions,
]);

export type MemberPermission = typeof MemberPermission.Type;

export const ownerRolePermissions: MemberPermission[] = [
  ...orgPermissions,
  ...billingPermissions,
  ...memberPermissions,
  ...rolePermissions,
  ...invitationPermissions,
  ...smartAccountPermissions,
  ...sessionKeyPermissions,
];

export const adminRolePermissions: MemberPermission[] = [
  "org:read",
  "billing:read",
  ...memberPermissions,
  ...rolePermissions,
  ...invitationPermissions,
  ...smartAccountPermissions,
  ...sessionKeyPermissions,
];

export const memberRolePermissions: MemberPermission[] = [
  "org:read",
  "member:read",
  "role:read",
  "smart_account:read",
  "session_key:read",
];

export const ownerRole: SystemRoleInsert = {
  key: "owner",
  permissions: ownerRolePermissions,
  version: 0,
  metadata: {
    name: "Owner",
    description: "System role for the organization owner",
    logo: {
      type: "icon",
      value: "crown",
    },
  },
};

export const adminRole: SystemRoleInsert = {
  key: "admin",
  permissions: adminRolePermissions,
  version: 0,
  metadata: {
    name: "Admin",
    description: "System role for admins.",
    logo: {
      type: "icon",
      value: "crown",
    },
  },
};

export const memberRole: SystemRoleInsert = {
  key: "member",
  permissions: memberRolePermissions,
  version: 0,
  metadata: {
    name: "Member",
    description: "System role for organization members",
    logo: {
      type: "icon",
      value: "user",
    },
  },
};

export const systemRolesInsert = [
  ownerRole,
  adminRole,
  memberRole,
] as SystemRoleInsert[];
